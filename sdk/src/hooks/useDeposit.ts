import { useCallback, useState } from "react";
import type { AccountInterface } from "starknet";
import type { DepositResult } from "../core";
import {
  buildPrivacyNote,
  resolveChainId,
  toAmountString,
  toError,
} from "./helpers";
import type { AmountLike, PrivacyNote } from "./types";
import { usePilikino, type UsePilikinoOptions } from "./usePilikino";

export interface DepositArgs {
  token: string;
  amountInPool: AmountLike;
  account?: AccountInterface;
  metadata?: Record<string, unknown>;
}

export interface UseDepositOptions extends UsePilikinoOptions {
  onSuccess?: (result: DepositResult, note: PrivacyNote) => void;
  onError?: (error: Error) => void;
}

export function useDeposit(options: UseDepositOptions) {
  const { onSuccess, onError, ...contextOptions } = options;
  const { sdk, account } = usePilikino(contextOptions);
  const [data, setData] = useState<DepositResult | null>(null);
  const [note, setNote] = useState<PrivacyNote | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deposit = useCallback(
    async (args: DepositArgs) => {
      if (!sdk) {
        throw new Error("PilikinoSDK is not initialized.");
      }

      const txAccount = args.account ?? account;
      if (!txAccount) {
        throw new Error(
          "No account available. Pass an account in hook options or call args.",
        );
      }

      setIsPending(true);
      setError(null);
      try {
        const result = await sdk.deposit(args.token, args.amountInPool, txAccount);
        const chainId = await resolveChainId(txAccount);

        const createdNote = buildPrivacyNote({
          id: `${result.commitment}:${result.txHash}`,
          poolAddress: sdk.poolAddress,
          token: args.token,
          amount: toAmountString(args.amountInPool),
          secret: result.secret,
          nullifier: result.nullifier,
          commitment: result.commitment,
          txHash: result.txHash,
          chainId,
          metadata: args.metadata,
        });

        setData(result);
        setNote(createdNote);
        onSuccess?.(result, createdNote);
        return result;
      } catch (caughtError) {
        const nextError = toError(caughtError);
        setError(nextError);
        onError?.(nextError);
        throw nextError;
      } finally {
        setIsPending(false);
      }
    },
    [sdk, account, onSuccess, onError],
  );

  const reset = useCallback(() => {
    setData(null);
    setNote(null);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    deposit,
    data,
    note,
    isPending,
    error,
    reset,
    sdk,
    account,
    isReady: Boolean(sdk && account),
  };
}
