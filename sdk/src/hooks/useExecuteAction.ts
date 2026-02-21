import { useCallback, useState } from "react";
import type { AccountInterface } from "starknet";
import type { ExecuteActionResult } from "../core";
import {
  buildPrivacyNote,
  resolveChainId,
  toError,
} from "./helpers";
import type { AmountLike, PrivacyNote } from "./types";
import { usePilikino, type UsePilikinoOptions } from "./usePilikino";

export interface ExecuteActionArgs {
  token: string;
  amountToWithdraw: AmountLike;
  target: string;
  selector: string | bigint;
  actionCalldata: AmountLike[];
  actionId: AmountLike;
  amountInPool?: AmountLike;
  secret?: string;
  nullifier?: string;
  note?: PrivacyNote;
  leaves?: string[];
  account?: AccountInterface;
  relayMetadata?: Record<string, unknown>;
}

export interface UseExecuteActionOptions extends UsePilikinoOptions {
  onSuccess?: (result: ExecuteActionResult, newNote: PrivacyNote) => void;
  onError?: (error: Error) => void;
}

export function useExecuteAction(options: UseExecuteActionOptions) {
  const { onSuccess, onError, ...contextOptions } = options;
  const { sdk, account } = usePilikino(contextOptions);
  const [data, setData] = useState<ExecuteActionResult | null>(null);
  const [nextNote, setNextNote] = useState<PrivacyNote | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeAction = useCallback(
    async (args: ExecuteActionArgs) => {
      if (!sdk) {
        throw new Error("PilikinoSDK is not initialized.");
      }

      const secret = args.secret ?? args.note?.secret;
      const nullifier = args.nullifier ?? args.note?.nullifier;
      const amountInPool = args.amountInPool ?? args.note?.amount;

      if (!secret || !nullifier) {
        throw new Error(
          "Missing secret or nullifier. Provide them directly or pass a note.",
        );
      }
      if (amountInPool === undefined) {
        throw new Error(
          "Missing amountInPool. Provide it directly or pass a note.",
        );
      }
      if (!args.leaves || args.leaves.length === 0) {
        throw new Error("Missing leaves. Provide the current Merkle tree leaves.");
      }

      setIsPending(true);
      setError(null);
      try {
        const result = await sdk.executeAction(
          {
            token: args.token,
            amountToWithdraw: args.amountToWithdraw,
            target: args.target,
            selector: args.selector,
            actionCalldata: args.actionCalldata,
            actionId: args.actionId,
            amountInPool,
            nullifier,
            secret,
            leaves: args.leaves,
            relayMetadata: args.relayMetadata,
          },
          args.account ?? account ?? undefined,
        );

        const chainId = await resolveChainId(args.account ?? account);
        const generatedNote = buildPrivacyNote({
          id: `${result.proof.newCommitment}:${result.txHash}`,
          poolAddress: sdk.poolAddress,
          token: args.token,
          amount: BigInt(result.proof.amountLeft).toString(),
          secret,
          nullifier: result.proof.newNullifier,
          commitment: result.proof.newCommitment,
          txHash: result.txHash,
          chainId,
          metadata: {
            sourceNoteId: args.note?.id,
            target: args.target,
            actionId: String(args.actionId),
            type: "executeAction",
          },
        });

        setData(result);
        setNextNote(generatedNote);
        onSuccess?.(result, generatedNote);
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
    setNextNote(null);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    executeAction,
    data,
    nextNote,
    isPending,
    error,
    reset,
    sdk,
    account,
    isReady: Boolean(sdk),
  };
}
