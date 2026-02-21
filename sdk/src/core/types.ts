import type { AccountInterface, BigNumberish, ProviderInterface } from "starknet";

export interface ProofArtifacts {
  circuit: any;
  verifyingKey: Uint8Array | string;
}

export interface RelayerTransportConfig {
  url?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface PilikinoSDKConfig {
  provider: ProviderInterface;
  poolAddress?: string;
  account?: AccountInterface;
  proofArtifacts?: Partial<ProofArtifacts>;
  relayer?: RelayerTransportConfig | null;
}

export interface DepositResult {
  txHash: string;
  secret: string;
  nullifier: string;
  commitment: string;
}

export interface ProofBundle {
  commitment: string;
  rootHash: string;
  nullifierHash: string;
  newNullifier: string;
  newCommitment: string;
  amountInPool: string;
  amountToWithdraw: string;
  amountLeft: string;
  dataHash: string;
  proofCalldata: bigint[];
  publicInputs: string[];
}

export interface BuildProofParams {
  nullifier: BigNumberish;
  secret: BigNumberish;
  amountInPool: BigNumberish;
  amountToWithdraw: BigNumberish;
  recipientOrTarget: BigNumberish;
  dataHash: BigNumberish;
  leaves: BigNumberish[];
}

export interface WithdrawParams {
  token: string;
  recipient: string;
  dataHash?: BigNumberish;
  amountToWithdraw: BigNumberish;
  amountInPool: BigNumberish;
  nullifier: BigNumberish;
  secret: BigNumberish;
  leaves: BigNumberish[];
  relayMetadata?: Record<string, unknown>;
}

export interface ExecuteActionParams {
  token: string;
  amountToWithdraw: BigNumberish;
  target: string;
  selector: string | bigint;
  actionCalldata: BigNumberish[];
  actionId: BigNumberish;
  amountInPool: BigNumberish;
  nullifier: BigNumberish;
  secret: BigNumberish;
  leaves: BigNumberish[];
  relayMetadata?: Record<string, unknown>;
}

export interface RelayQueuedResponse {
  request_id: string;
  queue_len: number;
  gas_estimate: string;
  min_required_fee_wei: string;
}

export interface RelayStatusResponse {
  request_id: string;
  status: "queued" | "submitted";
  tx_hash?: string | null;
}

export interface WithdrawResult {
  txHash: string;
  insertedLeafIndex?: bigint;
  relayRequestId?: string;
  relayQueueLength?: number;
  relayGasEstimate?: string;
  relayMinRequiredFeeWei?: string;
  proof: ProofBundle;
}

export interface ExecuteActionResult {
  txHash: string;
  success?: boolean;
  relayRequestId?: string;
  relayQueueLength?: number;
  relayGasEstimate?: string;
  relayMinRequiredFeeWei?: string;
  proof: ProofBundle;
}
