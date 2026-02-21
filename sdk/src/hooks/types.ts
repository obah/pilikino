export type AmountLike = string | number | bigint;

export interface PrivacyNote {
  id: string;
  poolAddress: string;
  token: string;
  amount: string;
  secret: string;
  nullifier: string;
  commitment: string;
  txHash: string;
  createdAt: number;
  chainId?: string;
  metadata?: Record<string, unknown>;
}
