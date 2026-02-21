import type { AccountInterface } from "starknet";
import type { AmountLike, PrivacyNote } from "./types";

export interface BuildPrivacyNoteArgs {
  poolAddress: string;
  token: string;
  amount: AmountLike;
  secret: string;
  nullifier: string;
  commitment: string;
  txHash: string;
  chainId?: string;
  id?: string;
  metadata?: Record<string, unknown>;
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

export function toAmountString(amount: AmountLike): string {
  if (typeof amount === "bigint") {
    return amount.toString();
  }
  return String(amount);
}

export async function resolveChainId(
  account: AccountInterface | null | undefined,
): Promise<string | undefined> {
  if (!account) {
    return undefined;
  }

  const candidate = account as unknown as {
    getChainId?: () => Promise<unknown>;
  };

  if (typeof candidate.getChainId !== "function") {
    return undefined;
  }

  const chainId = await candidate.getChainId();
  return chainId === undefined || chainId === null ? undefined : String(chainId);
}

export function buildPrivacyNote(args: BuildPrivacyNoteArgs): PrivacyNote {
  return {
    id: args.id ?? args.commitment,
    poolAddress: args.poolAddress,
    token: args.token,
    amount: toAmountString(args.amount),
    secret: args.secret,
    nullifier: args.nullifier,
    commitment: args.commitment,
    txHash: args.txHash,
    chainId: args.chainId,
    createdAt: Date.now(),
    metadata: args.metadata,
  };
}
