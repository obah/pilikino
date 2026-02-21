import type { AccountInterface, BigNumberish, ProviderInterface } from "starknet";

export interface ProofArtifacts {
  circuit: any;
  verifyingKey: Uint8Array | string;
}

export interface PilikinoSDKConfig {
  provider: ProviderInterface;
  poolAddress: string;
  account?: AccountInterface;
  proofArtifacts?: Partial<ProofArtifacts>;
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
}

export interface WithdrawResult {
  txHash: string;
  insertedLeafIndex?: bigint;
  proof: ProofBundle;
}

export interface ExecuteActionResult {
  txHash: string;
  success?: boolean;
  proof: ProofBundle;
}
