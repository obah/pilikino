import "./polyfills";

import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { getZKHonkCallData, poseidonHashBN254 } from "garaga";
import {
  AccountInterface,
  BigNumberish,
  Call,
  ProviderInterface,
  hash,
  selector,
} from "starknet";

import bundledCircuit from "./artifacts/circuits.json";
import { DEFAULT_PILIKINO_VK_HEX } from "./artifacts/vkHex";
import { MAX_120_BIT, MAX_248_BIT } from "./constants";
import { ensureGaragaInit, merkleTree } from "./merkleTree";
import type {
  BuildProofParams,
  DepositResult,
  ExecuteActionParams,
  ExecuteActionResult,
  PilikinoSDKConfig,
  ProofArtifacts,
  ProofBundle,
  RelayerTransportConfig,
  RelayQueuedResponse,
  RelayStatusResponse,
  WithdrawParams,
  WithdrawResult,
} from "./types";
import {
  assertMax248Bits,
  bytesFromHex,
  flattenFieldsAsArray,
  normalizeField,
  normalizeU256,
  parseBigInt,
  randomField,
  toBigIntValue,
  toHex32,
  txHashFromResponse,
  u256FromCallResult,
  u256ToCalldata,
} from "./utils";

const ZERO_DATA_HASH = 0n;

export const DEFAULT_PILIKINO_POOL_ADDRESS =
  "0x0719784b7a7c45247a9405d7f6acf25d5506423ab31f4af22c4c9613ee40b94d";

export const DEFAULT_PILIKINO_CIRCUIT = bundledCircuit;

export const DEFAULT_RELAYER_TRANSPORT_CONFIG: Required<
  Pick<RelayerTransportConfig, "url" | "endpoint">
> = {
  url: "https://pilikino-relayer.onrender.com",
  endpoint: "/relay",
};

type RelayerFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type RelayerFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<RelayerFetchResponse>;

function parseAddressAsField(address: string | bigint, label: string): bigint {
  return normalizeField(parseBigInt(address, label), label);
}

function parseSelector(input: string | bigint): bigint {
  if (typeof input === "bigint") {
    return normalizeField(input, "selector");
  }

  if (input.startsWith("0x") || /^\d+$/.test(input)) {
    return normalizeField(parseBigInt(input, "selector"), "selector");
  }

  return normalizeField(BigInt(selector.getSelectorFromName(input)), "selector");
}

function computeActionCalldataHash(
  actionId: bigint,
  selectorFelt: bigint,
  actionCalldata: bigint[],
): bigint {
  const words = [actionId, selectorFelt, ...actionCalldata];
  const packedKeccak = BigInt(hash.solidityUint256PackedKeccak256(words));
  // Cairo pool truncates by 8 bits: keccak_be / 256.
  return packedKeccak >> 8n;
}

export class PilikinoSDK {
  readonly provider: ProviderInterface;
  readonly poolAddress: string;

  private account?: AccountInterface;
  private proofArtifacts: Partial<ProofArtifacts>;
  private relayer?: RelayerTransportConfig | null;

  constructor(config: PilikinoSDKConfig) {
    this.provider = config.provider;
    this.poolAddress = config.poolAddress ?? DEFAULT_PILIKINO_POOL_ADDRESS;
    this.account = config.account;
    this.proofArtifacts = {
      circuit: DEFAULT_PILIKINO_CIRCUIT,
      verifyingKey: DEFAULT_PILIKINO_VK_HEX,
      ...(config.proofArtifacts ?? {}),
    };
    this.relayer = config.relayer;
  }

  connectAccount(account: AccountInterface): this {
    this.account = account;
    return this;
  }

  setProofArtifacts(artifacts: Partial<ProofArtifacts>): this {
    this.proofArtifacts = {
      ...(this.proofArtifacts ?? {}),
      ...artifacts,
    };
    return this;
  }

  setRelayer(config: RelayerTransportConfig | null): this {
    this.relayer = config;
    return this;
  }

  async generateCommitment(amountInPool: BigNumberish): Promise<{
    secret: string;
    nullifier: string;
    commitment: string;
    amountInPool: string;
  }> {
    await ensureGaragaInit();

    const amount = normalizeField(parseBigInt(amountInPool, "amountInPool"), "amountInPool");
    if (amount > MAX_120_BIT) {
      throw new Error("amountInPool must fit within 120 bits");
    }

    const secret = randomField();
    const nullifier = randomField();

    const commitment = poseidonHashBN254(
      poseidonHashBN254(nullifier, secret),
      amount,
    );

    return {
      secret: toHex32(secret),
      nullifier: toHex32(nullifier),
      commitment: toHex32(commitment),
      amountInPool: toHex32(amount),
    };
  }

  async deposit(
    token: string,
    amountInPool: BigNumberish,
    account?: AccountInterface,
  ): Promise<DepositResult> {
    const writer = this.requireWriter(account);
    const note = await this.generateCommitment(amountInPool);

    const amount = normalizeU256(parseBigInt(amountInPool, "amountInPool"), "amountInPool");
    const commitment = normalizeU256(parseBigInt(note.commitment, "commitment"), "commitment");

    const call: Call = {
      contractAddress: this.poolAddress,
      entrypoint: "deposit",
      calldata: [token, ...u256ToCalldata(amount), ...u256ToCalldata(commitment)],
    };

    const response = (await writer.execute(call)) as unknown as Record<string, unknown>;
    const txHash = txHashFromResponse(response);
    await this.provider.waitForTransaction(txHash);

    return {
      txHash,
      secret: note.secret,
      nullifier: note.nullifier,
      commitment: note.commitment,
    };
  }

  async buildProof(params: BuildProofParams): Promise<ProofBundle> {
    const artifacts = this.requireProofArtifacts();
    await ensureGaragaInit();

    const nullifier = normalizeField(parseBigInt(params.nullifier, "nullifier"), "nullifier");
    const secret = normalizeField(parseBigInt(params.secret, "secret"), "secret");
    const amountInPool = normalizeField(
      parseBigInt(params.amountInPool, "amountInPool"),
      "amountInPool",
    );
    const amountToWithdraw = normalizeField(
      parseBigInt(params.amountToWithdraw, "amountToWithdraw"),
      "amountToWithdraw",
    );

    if (amountInPool > MAX_120_BIT || amountToWithdraw > MAX_120_BIT) {
      throw new Error("amounts must fit within 120 bits");
    }
    if (amountToWithdraw > amountInPool) {
      throw new Error("amountToWithdraw cannot exceed amountInPool");
    }

    const recipientOrTarget = normalizeField(
      parseBigInt(params.recipientOrTarget, "recipientOrTarget"),
      "recipientOrTarget",
    );
    const dataHash = assertMax248Bits(
      normalizeField(parseBigInt(params.dataHash, "dataHash"), "dataHash"),
      "dataHash",
    );

    const amountLeft = amountInPool - amountToWithdraw;

    const commitment = poseidonHashBN254(
      poseidonHashBN254(nullifier, secret),
      amountInPool,
    );
    const nullifierHash = poseidonHashBN254(nullifier, 0n);

    const newNullifier = randomField();
    const actionContextHash = poseidonHashBN254(recipientOrTarget, dataHash);
    const newCommitment = poseidonHashBN254(
      poseidonHashBN254(newNullifier, secret),
      poseidonHashBN254(amountLeft, actionContextHash),
    );

    const commitmentHex = toHex32(commitment);
    const nullifierHashHex = toHex32(nullifierHash);
    const newNullifierHex = toHex32(newNullifier);
    const newCommitmentHex = toHex32(newCommitment);

    const normalizedLeaves = params.leaves.map((leaf) =>
      toHex32(normalizeField(parseBigInt(leaf, "leaf"), "leaf")),
    );

    const tree = await merkleTree(normalizedLeaves);
    const leafIndex = tree.getIndex(commitmentHex);
    if (leafIndex < 0) {
      throw new Error("computed commitment not found in provided leaves");
    }

    const merkleProof = tree.proof(leafIndex);

    const noir = new Noir(artifacts.circuit);
    const honk = new UltraHonkBackend(artifacts.circuit.bytecode, { threads: 1 });

    const witnessInput = {
      root_hash: BigInt(merkleProof.root).toString(),
      nullifier_hash: BigInt(nullifierHashHex).toString(),
      recipient_address: recipientOrTarget.toString(),
      data_hash: dataHash.toString(),
      amount_to_withdraw: amountToWithdraw.toString(),
      new_commitment: BigInt(newCommitmentHex).toString(),
      nullifier: nullifier.toString(),
      new_nullifier: BigInt(newNullifierHex).toString(),
      secret: secret.toString(),
      amount_in_pool: amountInPool.toString(),
      amount_left: amountLeft.toString(),
      merkle_proof: merkleProof.pathElements.map((x) => BigInt(x).toString()),
      is_even: merkleProof.pathIndices.map((idx) => idx % 2 === 0),
    };

    const { witness } = await noir.execute(witnessInput);
    const proofData = await honk.generateProof(witness, { keccakZK: true });

    const publicInputsBytes = flattenFieldsAsArray(proofData.publicInputs as Array<string | bigint>);
    const encodedProofCalldata = getZKHonkCallData(
      proofData.proof,
      publicInputsBytes,
      artifacts.verifyingKey,
    );

    // Garaga JS returns [len, ...proof_felts]. The verifier entrypoint expects only proof felts.
    const proofCalldata =
      encodedProofCalldata.length > 0
      && encodedProofCalldata[0] === BigInt(encodedProofCalldata.length - 1)
        ? encodedProofCalldata.slice(1)
        : encodedProofCalldata;

    const rootHash = toHex32(BigInt(merkleProof.root));
    const isKnownRoot = await this.isKnownRoot(rootHash);
    if (!isKnownRoot) {
      throw new Error(
        `proof root ${rootHash} is not known by pool ${this.poolAddress}; refresh leaves from chain and retry`,
      );
    }

    return {
      commitment: commitmentHex,
      rootHash,
      nullifierHash: nullifierHashHex,
      newNullifier: newNullifierHex,
      newCommitment: newCommitmentHex,
      amountInPool: toHex32(amountInPool),
      amountToWithdraw: toHex32(amountToWithdraw),
      amountLeft: toHex32(amountLeft),
      dataHash: toHex32(dataHash),
      proofCalldata,
      publicInputs: (proofData.publicInputs as unknown[]).map((x, i) =>
        toBigIntValue(x, `publicInputs[${i}]`).toString(),
      ),
    };
  }

  async withdraw(params: WithdrawParams, account?: AccountInterface): Promise<WithdrawResult> {
    const amountToWithdraw = normalizeU256(
      parseBigInt(params.amountToWithdraw, "amountToWithdraw"),
      "amountToWithdraw",
    );

    const withdrawDataHash = params.dataHash === undefined
      ? ZERO_DATA_HASH
      : assertMax248Bits(
          normalizeField(parseBigInt(params.dataHash, "dataHash"), "dataHash"),
          "dataHash",
        );

    const proof = await this.buildProof({
      nullifier: params.nullifier,
      secret: params.secret,
      amountInPool: params.amountInPool,
      amountToWithdraw,
      recipientOrTarget: parseAddressAsField(params.recipient, "recipient"),
      dataHash: withdrawDataHash,
      leaves: params.leaves,
    });

    const relayer = this.resolveRelayerConfig();
    if (relayer) {
      const relayResult = await this.submitToRelayer(proof, {
        operation: "withdraw",
        token: params.token,
        recipient: params.recipient,
        amount: toHex32(amountToWithdraw),
        nullifierHash: proof.nullifierHash,
        rootHash: proof.rootHash,
        calldataHash: proof.dataHash,
        newCommitment: proof.newCommitment,
        ...params.relayMetadata,
      });

      return {
        txHash: `relay:${relayResult.request_id}`,
        relayRequestId: relayResult.request_id,
        relayQueueLength: relayResult.queue_len,
        relayGasEstimate: relayResult.gas_estimate,
        relayMinRequiredFeeWei: relayResult.min_required_fee_wei,
        proof,
      };
    }

    const writer = this.requireWriter(account);

    const nullifierHash = normalizeU256(parseBigInt(proof.nullifierHash, "nullifierHash"), "nullifierHash");
    const rootHash = normalizeU256(parseBigInt(proof.rootHash, "rootHash"), "rootHash");
    const calldataHash = normalizeU256(parseBigInt(proof.dataHash, "dataHash"), "dataHash");
    const newCommitment = normalizeU256(parseBigInt(proof.newCommitment, "newCommitment"), "newCommitment");

    const call: Call = {
      contractAddress: this.poolAddress,
      entrypoint: "withdraw",
      calldata: [
        params.token,
        params.recipient,
        ...u256ToCalldata(amountToWithdraw),
        ...u256ToCalldata(nullifierHash),
        proof.proofCalldata.length.toString(),
        ...proof.proofCalldata.map((x) => x.toString()),
        ...u256ToCalldata(rootHash),
        ...u256ToCalldata(calldataHash),
        ...u256ToCalldata(newCommitment),
      ],
    };

    const response = (await writer.execute(call)) as unknown as Record<string, unknown>;
    const txHash = txHashFromResponse(response);
    await this.provider.waitForTransaction(txHash);

    return {
      txHash,
      proof,
    };
  }

  async executeAction(
    params: ExecuteActionParams,
    account?: AccountInterface,
  ): Promise<ExecuteActionResult> {
    const amountToWithdraw = normalizeU256(
      parseBigInt(params.amountToWithdraw, "amountToWithdraw"),
      "amountToWithdraw",
    );
    const actionId = normalizeU256(parseBigInt(params.actionId, "actionId"), "actionId");
    const selectorFelt = parseSelector(params.selector);
    const actionCalldata = params.actionCalldata.map((value, idx) =>
      normalizeField(parseBigInt(value, `actionCalldata[${idx}]`), `actionCalldata[${idx}]`),
    );

    const dataHash = computeActionCalldataHash(actionId, selectorFelt, actionCalldata);
    if (dataHash > MAX_248_BIT) {
      throw new Error("executeAction data hash exceeds 248 bits");
    }

    const proof = await this.buildProof({
      nullifier: params.nullifier,
      secret: params.secret,
      amountInPool: params.amountInPool,
      amountToWithdraw,
      recipientOrTarget: parseAddressAsField(params.target, "target"),
      dataHash,
      leaves: params.leaves,
    });

    const relayer = this.resolveRelayerConfig();
    if (relayer) {
      const relayResult = await this.submitToRelayer(proof, {
        operation: "execute_action",
        token: params.token,
        amount: toHex32(amountToWithdraw),
        target: params.target,
        selector: selectorFelt.toString(),
        actionCalldata: actionCalldata.map((x) => x.toString()),
        actionId: toHex32(actionId),
        nullifierHash: proof.nullifierHash,
        rootHash: proof.rootHash,
        newCommitment: proof.newCommitment,
        ...params.relayMetadata,
      });

      return {
        txHash: `relay:${relayResult.request_id}`,
        relayRequestId: relayResult.request_id,
        relayQueueLength: relayResult.queue_len,
        relayGasEstimate: relayResult.gas_estimate,
        relayMinRequiredFeeWei: relayResult.min_required_fee_wei,
        proof,
      };
    }

    const writer = this.requireWriter(account);

    const nullifierHash = normalizeU256(parseBigInt(proof.nullifierHash, "nullifierHash"), "nullifierHash");
    const rootHash = normalizeU256(parseBigInt(proof.rootHash, "rootHash"), "rootHash");
    const newCommitment = normalizeU256(parseBigInt(proof.newCommitment, "newCommitment"), "newCommitment");

    const call: Call = {
      contractAddress: this.poolAddress,
      entrypoint: "execute_action",
      calldata: [
        params.token,
        ...u256ToCalldata(amountToWithdraw),
        params.target,
        selectorFelt.toString(),
        actionCalldata.length.toString(),
        ...actionCalldata.map((x) => x.toString()),
        ...u256ToCalldata(actionId),
        ...u256ToCalldata(nullifierHash),
        proof.proofCalldata.length.toString(),
        ...proof.proofCalldata.map((x) => x.toString()),
        ...u256ToCalldata(rootHash),
        ...u256ToCalldata(newCommitment),
      ],
    };

    const response = (await writer.execute(call)) as unknown as Record<string, unknown>;
    const txHash = txHashFromResponse(response);
    await this.provider.waitForTransaction(txHash);

    return {
      txHash,
      proof,
    };
  }

  async getRelayStatus(requestId: string): Promise<RelayStatusResponse> {
    const relayer = this.resolveRelayerConfig();
    if (!relayer) {
      throw new Error("Relayer is disabled for this SDK instance");
    }

    const fetchFn = this.getRelayerFetch();
    const endpoint = this.resolveRelayerEndpoint(`/${encodeURIComponent(requestId)}`);

    const response = await fetchFn(endpoint, {
      method: "GET",
      headers: {
        ...(relayer.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch relay status (${response.status})`);
    }

    const body = (await response.json()) as RelayStatusResponse;
    if (!body?.request_id || !body?.status) {
      throw new Error("Invalid relay status response payload");
    }

    return body;
  }

  async getRoot(index: BigNumberish): Promise<bigint> {
    const response = await this.provider.callContract({
      contractAddress: this.poolAddress,
      entrypoint: "get_root",
      calldata: [parseBigInt(index, "index").toString()],
    });

    return u256FromCallResult(response);
  }

  async isKnownRoot(root: BigNumberish): Promise<boolean> {
    const rootBig = normalizeU256(parseBigInt(root, "root"), "root");

    const response = await this.provider.callContract({
      contractAddress: this.poolAddress,
      entrypoint: "is_known_root",
      calldata: [...u256ToCalldata(rootBig)],
    });

    return BigInt(response[0]) !== 0n;
  }

  async isTokenSupported(token: string): Promise<boolean> {
    const response = await this.provider.callContract({
      contractAddress: this.poolAddress,
      entrypoint: "is_token_supported",
      calldata: [token],
    });

    return BigInt(response[0]) !== 0n;
  }

  async getVerifierAddress(): Promise<string> {
    const response = await this.provider.callContract({
      contractAddress: this.poolAddress,
      entrypoint: "get_verifier",
      calldata: [],
    });

    if (!response[0]) {
      throw new Error("empty verifier address response");
    }

    return response[0];
  }

  private resolveRelayerConfig(): RelayerTransportConfig | null {
    if (this.relayer === null) {
      return null;
    }

    const configured = this.relayer ?? {};

    return {
      url: configured.url ?? DEFAULT_RELAYER_TRANSPORT_CONFIG.url,
      endpoint: configured.endpoint ?? DEFAULT_RELAYER_TRANSPORT_CONFIG.endpoint,
      headers: configured.headers,
      metadata: configured.metadata,
    };
  }

  private resolveRelayerEndpoint(suffix = ""): string {
    const relayer = this.resolveRelayerConfig();
    if (!relayer) {
      throw new Error("Relayer is disabled for this SDK instance");
    }

    const base = (relayer.url ?? DEFAULT_RELAYER_TRANSPORT_CONFIG.url).endsWith("/")
      ? (relayer.url ?? DEFAULT_RELAYER_TRANSPORT_CONFIG.url).slice(0, -1)
      : (relayer.url ?? DEFAULT_RELAYER_TRANSPORT_CONFIG.url);

    const endpoint = relayer.endpoint ?? DEFAULT_RELAYER_TRANSPORT_CONFIG.endpoint;
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    return `${base}${normalizedEndpoint}${suffix}`;
  }

  private getRelayerFetch(): RelayerFetch {
    const fetchFn = (globalThis as unknown as { fetch?: RelayerFetch }).fetch;
    if (typeof fetchFn !== "function") {
      throw new Error(
        "Global fetch is unavailable in this runtime. Provide a fetch-capable environment for relayer transport.",
      );
    }

    return fetchFn;
  }

  private async submitToRelayer(
    proof: ProofBundle,
    operationMetadata: Record<string, unknown>,
  ): Promise<RelayQueuedResponse> {
    const relayer = this.resolveRelayerConfig();
    if (!relayer) {
      throw new Error("Relayer is disabled for this SDK instance");
    }

    const fetchFn = this.getRelayerFetch();
    const endpoint = this.resolveRelayerEndpoint();

    const metadata = {
      ...(relayer.metadata ?? {}),
      ...operationMetadata,
    };

    const payload: {
      proof_calldata: string[];
      public_inputs: string[];
      metadata?: Record<string, unknown>;
    } = {
      proof_calldata: proof.proofCalldata.map((value) => value.toString()),
      public_inputs: proof.publicInputs,
    };

    if (Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    }

    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(relayer.headers ?? {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `Relayer request failed with status ${response.status}`;

      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) {
          errorMessage = `Relayer request failed: ${body.error}`;
        }
      } catch {
        const bodyText = await response.text();
        if (bodyText) {
          errorMessage = `Relayer request failed: ${bodyText}`;
        }
      }

      throw new Error(errorMessage);
    }

    const body = (await response.json()) as RelayQueuedResponse;
    if (!body?.request_id) {
      throw new Error("Relayer response is missing request_id");
    }

    return body;
  }

  private requireWriter(account?: AccountInterface): AccountInterface {
    const writer = account ?? this.account;
    if (!writer) {
      throw new Error("No account configured. Pass an account or call connectAccount().");
    }
    return writer;
  }

  private requireProofArtifacts(): { circuit: any; verifyingKey: Uint8Array } {
    const circuit = this.proofArtifacts?.circuit;
    const verifyingKeyInput = this.proofArtifacts?.verifyingKey;

    if (!circuit) {
      throw new Error("Missing proof artifact: circuit");
    }
    if (!verifyingKeyInput) {
      throw new Error("Missing proof artifact: verifyingKey");
    }

    const verifyingKey =
      typeof verifyingKeyInput === "string"
        ? bytesFromHex(verifyingKeyInput)
        : verifyingKeyInput;

    return { circuit, verifyingKey };
  }
}
