import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { merkleTree } from "./merkleTree";
import { poseidonHashBN254, init } from "garaga";
import {
  MAX_120_BIT,
  MAX_248_BIT,
  parseBigInt,
  toHex32,
  hexToDecString,
  flattenFieldsAsArray,
  splitU256,
  randomField,
} from "./utils";

async function main() {
  await init();
  const args = process.argv.slice(2);
  if (args.length < 7) {
    throw new Error(
      "usage: npx tsx contracts/scripts/generateProof.ts <nullifier> <secret> <amount_in_pool> <amount_to_withdraw> <recipient_address> <data_hash_248b> <leaf1> [leaf2 ...]",
    );
  }

  const [
    nullifierArg,
    secretArg,
    amountInPoolArg,
    amountToWithdrawArg,
    recipientArg,
    dataHashArg,
    ...leaves
  ] = args;

  const nullifier = parseBigInt(nullifierArg, "nullifier");
  const secret = parseBigInt(secretArg, "secret");
  const amountInPool = parseBigInt(amountInPoolArg, "amount_in_pool");
  const amountToWithdraw = parseBigInt(
    amountToWithdrawArg,
    "amount_to_withdraw",
  );
  const recipient = parseBigInt(recipientArg, "recipient_address");
  const dataHash = parseBigInt(dataHashArg, "data_hash");

  if (amountInPool > MAX_120_BIT || amountToWithdraw > MAX_120_BIT) {
    throw new Error("amount values must fit in 120 bits");
  }
  if (amountToWithdraw > amountInPool) {
    throw new Error("amount_to_withdraw cannot exceed amount_in_pool");
  }
  if (dataHash > MAX_248_BIT) {
    throw new Error("data_hash must be <= 248 bits (truncated keccak)");
  }

  const commitment = poseidonHashBN254(
    poseidonHashBN254(nullifier, secret),
    amountInPool,
  );
  const nullifierHash = poseidonHashBN254(nullifier, 0n);

  const amountLeft = amountInPool - amountToWithdraw;

  const newNullifier = randomField();
  const actionContextHash = poseidonHashBN254(recipient, dataHash);
  const newCommitment = poseidonHashBN254(
    poseidonHashBN254(newNullifier, secret),
    poseidonHashBN254(amountLeft, actionContextHash),
  );

  const commitmentHex = toHex32(commitment);
  const nullifierHashHex = toHex32(nullifierHash);

  const newNullifierHex = toHex32(newNullifier);
  const newCommitmentHex = toHex32(newCommitment);

  const normalizedLeaves = leaves.map((leaf) =>
    toHex32(parseBigInt(leaf, "leaf")),
  );
  const tree = await merkleTree(normalizedLeaves);
  const leafIndex = tree.getIndex(commitmentHex);
  if (leafIndex < 0) {
    throw new Error("computed commitment not found in provided leaves");
  }

  const merkleProof = tree.proof(leafIndex);

  const circuitPath = path.resolve(
    __dirname,
    "../../circuits/target/circuits.json",
  );
  const circuit = JSON.parse(fs.readFileSync(circuitPath, "utf8"));

  const noir = new Noir(circuit);
  const honk = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  const witnessInput = {
    root_hash: hexToDecString(merkleProof.root),
    nullifier_hash: hexToDecString(nullifierHashHex),
    recipient_address: recipient.toString(),
    data_hash: dataHash.toString(),
    amount_to_withdraw: amountToWithdraw.toString(),
    new_commitment: hexToDecString(newCommitmentHex),
    nullifier: nullifier.toString(),
    new_nullifier: hexToDecString(newNullifierHex),
    secret: secret.toString(),
    amount_in_pool: amountInPool.toString(),
    amount_left: amountLeft.toString(),
    merkle_proof: merkleProof.pathElements.map(hexToDecString),
    is_even: merkleProof.pathIndices.map((idx) => idx % 2 === 0),
  };

  const { witness } = await noir.execute(witnessInput);
  const proofData = await honk.generateProof(witness, { keccakZK: true });

  const contractsDir = path.resolve(__dirname, "..");
  const fixturesDir = path.resolve(__dirname, "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });

  const proofBinPath = path.join(fixturesDir, "proof.bin");
  const publicInputsBinPath = path.join(fixturesDir, "public_inputs.bin");
  const proofCalldataPath = path.join(fixturesDir, "proof_calldata.txt");
  const withdrawInputsPath = path.join(fixturesDir, "withdraw_inputs.txt");
  const metadataPath = path.join(fixturesDir, "proof_metadata.json");

  fs.writeFileSync(proofBinPath, Buffer.from(proofData.proof));
  fs.writeFileSync(
    publicInputsBinPath,
    Buffer.from(flattenFieldsAsArray(proofData.publicInputs)),
  );

  const vkPath = path.resolve(__dirname, "../../circuits/target/vk/vk");

  const garagaOutput = execFileSync(
    "garaga",
    [
      "calldata",
      "--system",
      "ultra_keccak_zk_honk",
      "--proof",
      proofBinPath,
      "--public-inputs",
      publicInputsBinPath,
      "--vk",
      vkPath,
      "--format",
      "array",
    ],
    {
      cwd: contractsDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const calldataTokens = garagaOutput.match(/0x[0-9a-fA-F]+|\d+/g) ?? [];
  if (calldataTokens.length === 0) {
    throw new Error(`failed to parse garaga calldata output: ${garagaOutput}`);
  }

  const calldataDecimals = calldataTokens.map((token) =>
    token.startsWith("0x") ? BigInt(token).toString() : token,
  );
  fs.writeFileSync(
    proofCalldataPath,
    `${calldataDecimals.join("\n")}\n`,
    "utf8",
  );

  const withdrawInputs = [
    ...splitU256(BigInt(commitmentHex)),
    ...splitU256(BigInt(merkleProof.root)),
    ...splitU256(BigInt(nullifierHashHex)),
    ...splitU256(dataHash),
    ...splitU256(BigInt(newCommitmentHex)),
    ...splitU256(amountToWithdraw),
    recipient,
  ].map((value) => value.toString());
  fs.writeFileSync(
    withdrawInputsPath,
    `${withdrawInputs.join("\n")}\n`,
    "utf8",
  );

  const metadata = {
    commitment: commitmentHex,
    root_hash: toHex32(BigInt(merkleProof.root)),
    nullifier_hash: nullifierHashHex,
    new_nullifier: newNullifierHex,
    new_commitment: newCommitmentHex,
    recipient_address: toHex32(recipient),
    data_hash: toHex32(dataHash),
    amount_in_pool: toHex32(amountInPool),
    amount_to_withdraw: toHex32(amountToWithdraw),
    amount_left: toHex32(amountLeft),
    proof_calldata_path: path.relative(contractsDir, proofCalldataPath),
    withdraw_inputs_path: path.relative(contractsDir, withdrawInputsPath),
  };

  fs.writeFileSync(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
