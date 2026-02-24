"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDown, Info, Loader2 } from "lucide-react";
import Faucet from "./Faucet";
import { DEMO_CONTRACTS } from "@/lib/demo-config";
import { fetchPoolCommitmentLeavesWithRetry } from "@/lib/pool-leaves";
import { formatTokenAmount, parseAmountInput, toU256 } from "@/lib/starknet";
import { toast } from "sonner";
import type {
  NormalTransactionReporter,
  PrivateTransactionReporter,
} from "./transaction-log-types";
import { useDeposit, useExecuteAction } from "pilikino/hooks";
import { useAccount, useProvider } from "@starknet-react/core";
import { CallData, hash } from "starknet";

interface DefiDemoContentProps {
  isIncognito: boolean;
  onNormalTransaction?: NormalTransactionReporter;
  onPrivateTransaction?: PrivateTransactionReporter;
}

function parseU256(words: Array<string | bigint>, start = 0): bigint {
  const low = BigInt(words[start] ?? 0);
  const high = BigInt(words[start + 1] ?? 0);
  return low + (high << 128n);
}

function formatTwoDecimals(amount: bigint): string {
  const formatted = formatTokenAmount(amount);
  const [whole, fraction = ""] = formatted.split(".");
  return `${whole}.${(fraction + "00").slice(0, 2)}`;
}

function toHexTxHash(value: string): `0x${string}` {
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return `0x${BigInt(value).toString(16)}` as `0x${string}`;
}

export default function DefiDemoContent({
  isIncognito,
  onNormalTransaction,
  onPrivateTransaction,
}: DefiDemoContentProps) {
  const { address, account } = useAccount();
  const { provider } = useProvider();

  const [amountIn, setAmountIn] = useState("");
  const [pendingTxType, setPendingTxType] = useState<"approval" | "swap" | null>(null);
  const [isPrivatePending, setIsPrivatePending] = useState(false);
  const [ppUSDBalance, setPpUSDBalance] = useState<bigint>(0n);
  const [usdtppBalance, setUsdtppBalance] = useState<bigint>(0n);
  const [defiAllowance, setDefiAllowance] = useState<bigint>(0n);

  const { deposit } = useDeposit({
    poolAddress: DEMO_CONTRACTS.PilikinoPool,
    provider,
    account,
  });

  const { executeAction } = useExecuteAction({
    poolAddress: DEMO_CONTRACTS.PilikinoPool,
    provider,
    account,
  });

  const parsedAmount = useMemo(() => parseAmountInput(amountIn), [amountIn]);

  const refreshBalances = useCallback(async () => {
    if (!address) {
      setPpUSDBalance(0n);
      setUsdtppBalance(0n);
      setDefiAllowance(0n);
      return;
    }

    try {
      const [ppUsdRes, usdtppRes, allowanceRes] = await Promise.all([
        provider.callContract({
          contractAddress: DEMO_CONTRACTS.ppUSD,
          entrypoint: "balance_of",
          calldata: [address],
        }),
        provider.callContract({
          contractAddress: DEMO_CONTRACTS.USDTpp,
          entrypoint: "balance_of",
          calldata: [address],
        }),
        provider.callContract({
          contractAddress: DEMO_CONTRACTS.ppUSD,
          entrypoint: "allowance",
          calldata: [address, DEMO_CONTRACTS.DemoDefi],
        }),
      ]);

      setPpUSDBalance(parseU256(ppUsdRes));
      setUsdtppBalance(parseU256(usdtppRes));
      setDefiAllowance(parseU256(allowanceRes));
    } catch {
      setPpUSDBalance(0n);
      setUsdtppBalance(0n);
      setDefiAllowance(0n);
    }
  }, [address, provider]);

  useEffect(() => {
    void refreshBalances();
    const interval = setInterval(() => {
      void refreshBalances();
    }, 2000);

    return () => clearInterval(interval);
  }, [refreshBalances]);

  const needsApproval =
    parsedAmount !== null && parsedAmount !== undefined
      ? defiAllowance < parsedAmount
      : false;

  const isPending = isIncognito
    ? isPrivatePending
    : pendingTxType !== null;

  const ensurePoolApproval = useCallback(async () => {
    if (!account || !address || !parsedAmount) {
      return;
    }

    const allowanceRes = await provider.callContract({
      contractAddress: DEMO_CONTRACTS.ppUSD,
      entrypoint: "allowance",
      calldata: [address, DEMO_CONTRACTS.PilikinoPool],
    });

    const allowance = parseU256(allowanceRes);
    if (allowance >= parsedAmount) {
      return;
    }

    const approveTx = await account.execute({
      contractAddress: DEMO_CONTRACTS.ppUSD,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: DEMO_CONTRACTS.PilikinoPool,
        amount: toU256(parsedAmount),
      }),
    });

    await provider.waitForTransaction(approveTx.transaction_hash);
  }, [account, address, parsedAmount, provider]);

  const assertPrivateTokenSupported = useCallback(async () => {
    const response = await provider.callContract({
      contractAddress: DEMO_CONTRACTS.PilikinoPool,
      entrypoint: "is_token_supported",
      calldata: [DEMO_CONTRACTS.ppUSD],
    });

    const isSupported = BigInt(response[0] ?? 0) === 1n;
    if (!isSupported) {
      throw new Error(
        `Pool does not support token ${DEMO_CONTRACTS.ppUSD}. Add it with add_supported_token before private swaps.`,
      );
    }
  }, [provider]);

  const submitSwap = useCallback(async () => {
    if (!account || !parsedAmount) {
      throw new Error("Please connect your wallet and enter a valid amount");
    }

    setPendingTxType("swap");
    const swapTx = await account.execute({
      contractAddress: DEMO_CONTRACTS.DemoDefi,
      entrypoint: "swap_simple",
      calldata: CallData.compile({ amount_in: toU256(parsedAmount) }),
    });

    onNormalTransaction?.({
      hash: toHexTxHash(swapTx.transaction_hash),
      source: "defi",
      methodHint: "swap",
      parametersHint: `amountIn=${amountIn || "0"}`,
      privacyLevel: "Public",
      initiator: address,
      gasPayer: address,
    });

    await provider.waitForTransaction(swapTx.transaction_hash);
    toast.success("Swap successful!");
  }, [account, amountIn, onNormalTransaction, parsedAmount, provider]);

  const handleAction = async () => {
    if (!address || !account) {
      toast.error("Please connect your wallet");
      return;
    }
    if (parsedAmount === null || parsedAmount <= 0n) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (isIncognito) {
      setIsPrivatePending(true);
      try {
        await assertPrivateTokenSupported();
        await ensurePoolApproval();

        const depositResult = await deposit({
          token: DEMO_CONTRACTS.ppUSD,
          amountInPool: parsedAmount,
          account,
          metadata: { source: "defi" },
        });

        onPrivateTransaction?.({
          hash: depositResult.txHash,
          source: "defi",
          methodHint: "deposit",
          parametersHint: `token=${DEMO_CONTRACTS.ppUSD}, amount=${parsedAmount.toString()}`,
          privacyLevel: "Private",
          metadata: {
            initiator: address,
            gasPayer: address,
            method: "deposit",
            parameters: `token=${DEMO_CONTRACTS.ppUSD}, amount=${parsedAmount.toString()}`,
            status: "success",
            noteCommitment: depositResult.commitment,
          },
        });

        const leaves = await fetchPoolCommitmentLeavesWithRetry(
          provider,
          DEMO_CONTRACTS.PilikinoPool,
          depositResult.commitment,
        );

        const amountU256 = toU256(parsedAmount);
        const executeResult = await executeAction({
          token: DEMO_CONTRACTS.ppUSD,
          amountToWithdraw: parsedAmount,
          target: DEMO_CONTRACTS.DemoDefi,
          selector: hash.getSelectorFromName("swap_simple"),
          actionCalldata: [BigInt(amountU256.low), BigInt(amountU256.high)],
          actionId: BigInt(Date.now()),
          amountInPool: parsedAmount,
          secret: depositResult.secret,
          nullifier: depositResult.nullifier,
          leaves,
          account,
        });

        onPrivateTransaction?.({
          hash: executeResult.txHash,
          source: "defi",
          methodHint: "executeAction(swap)",
          parametersHint: `amountIn=${amountIn}, tokenIn=ppUSD, tokenOut=USDTpp`,
          privacyLevel: "Private",
          metadata: {
            initiator: address,
            gasPayer: executeResult.relayRequestId ? "relayer" : address,
            method: "swap_simple",
            parameters: `amountIn=${amountIn}`,
            status: executeResult.relayRequestId ? "pending" : "success",
            noteCommitment: executeResult.proof.newCommitment,
            relayRequestId: executeResult.relayRequestId,
            relayQueueLength: executeResult.relayQueueLength,
            relayGasEstimate: executeResult.relayGasEstimate,
            relayMinRequiredFeeWei: executeResult.relayMinRequiredFeeWei,
          },
        });

        toast.success("Private swap submitted successfully.");
        setAmountIn("");
        await refreshBalances();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Private swap failed";
        toast.error(`Private swap failed: ${message}`);
      } finally {
        setIsPrivatePending(false);
      }

      return;
    }

    try {
      if (needsApproval) {
        setPendingTxType("approval");
        const approvalTx = await account.execute({
          contractAddress: DEMO_CONTRACTS.ppUSD,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: DEMO_CONTRACTS.DemoDefi,
            amount: toU256(parsedAmount),
          }),
        });

        onNormalTransaction?.({
          hash: toHexTxHash(approvalTx.transaction_hash),
          source: "defi",
          methodHint: "approve",
          parametersHint: `spender=${DEMO_CONTRACTS.DemoDefi}, amount=${amountIn || "0"}`,
          privacyLevel: "Public",
          initiator: address,
          gasPayer: address,
        });

        await provider.waitForTransaction(approvalTx.transaction_hash);
        toast.success("Approval successful! Initiating swap...");
      }

      await submitSwap();
      setAmountIn("");
      await refreshBalances();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaction failed";
      toast.error(`Transaction failed: ${message}`);
    } finally {
      setPendingTxType(null);
    }
  };

  const formattedBalanceIn = formatTwoDecimals(ppUSDBalance);
  const formattedBalanceOut = formatTwoDecimals(usdtppBalance);

  return (
    <div className="space-y-10">
      <Card className="mx-auto w-full max-w-lg border border-emerald-500/35 bg-transparent shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_12px_28px_-22px_rgba(16,185,129,0.45)] backdrop-blur-xl dark:border-emerald-500/30 dark:bg-[radial-gradient(circle_at_top,#123223_0%,#070d0a_46%,#040806_100%)] dark:shadow-[0_0_0_1px_rgba(16,185,129,0.1),0_20px_40px_-28px_rgba(16,185,129,0.9)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-emerald-900 dark:text-emerald-50">
            Swap Tokens
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 rounded-md">
          <div className="space-y-2 border border-emerald-500/35 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-[#06120d]">
            <div className="flex justify-between text-sm text-emerald-800/85 dark:text-emerald-100/70">
              <Label>Pay</Label>
              <span>Balance: {formattedBalanceIn}</span>
            </div>

            <div className="flex items-center gap-4">
              <Input
                className="h-10 w-full bg-transparent pl-2 text-2xl font-bold text-emerald-900 shadow-none placeholder:text-emerald-700/45 focus-visible:ring-0 dark:text-emerald-50 dark:placeholder:text-emerald-100/40"
                placeholder="0.0"
                value={amountIn}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAmountIn(e.target.value.trim())
                }
              />

              <div className="flex w-[120px] items-center justify-center rounded-sm border border-emerald-500/45 bg-emerald-500/10 py-[10px] font-medium text-emerald-800 dark:border-emerald-500/35 dark:text-emerald-100">
                <span className="flex items-center gap-2">ppUSD</span>
              </div>
            </div>
            <div className="text-xs text-emerald-800/80 dark:text-emerald-100/65">
              ≈ ${amountIn || "0.00"}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center">
            <div className="rounded-xl border border-emerald-500/45 bg-emerald-500/5 p-2 text-emerald-800/85 dark:border-emerald-500/35 dark:bg-[#06120d] dark:text-emerald-100/80">
              <ArrowDown size={16} />
            </div>
          </div>

          <div className="space-y-2 border border-emerald-500/35 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-[#06120d]">
            <div className="flex justify-between text-sm text-emerald-800/85 dark:text-emerald-100/70">
              <Label>Receive</Label>
              <span>Balance: {formattedBalanceOut}</span>
            </div>
            <div className="flex items-center gap-4">
              <Input
                className="h-10 w-full bg-transparent p-0 pl-2 text-2xl font-bold text-emerald-900 shadow-none placeholder:text-emerald-700/45 focus-visible:ring-0 dark:text-emerald-50 dark:placeholder:text-emerald-100/40"
                placeholder="0.0"
                readOnly
                value={amountIn}
              />
              <div className="flex w-[120px] items-center justify-center rounded-sm border border-emerald-500/45 bg-emerald-500/10 py-[10px] font-medium text-emerald-800 dark:border-emerald-500/35 dark:text-emerald-100">
                <span className="flex items-center gap-2">USDTpp</span>
              </div>
            </div>
            <div className="text-xs text-emerald-800/80 dark:text-emerald-100/65">
              ≈ ${amountIn || "0.00"}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm text-emerald-800/80 dark:text-emerald-100/65">
              <div className="flex items-center gap-1">
                <span>Privacy Fee</span>
                <Info size={12} />
              </div>
              <span>0% (Demo)</span>
            </div>
          </div>

          {isIncognito ? (
            <div className="rounded-md border border-emerald-500/35 bg-emerald-500/8 p-3 text-xs text-emerald-900/85 dark:border-emerald-400/30 dark:bg-emerald-400/8 dark:text-emerald-100/80">
              Demo note: private swaps are routed through Pilikino proof
              verification and relayer execution flow. Confirmed execution can
              be tracked from the private logs panel.
            </div>
          ) : null}

          <Button
            className="mt-4 h-12 w-full border border-emerald-500/50 bg-emerald-500/15 text-lg font-semibold text-emerald-900 hover:bg-emerald-500/25 dark:border-emerald-300/45 dark:text-emerald-50"
            onClick={handleAction}
            disabled={isPending || !address || parsedAmount === null}
          >
            {isIncognito ? (
              isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting private swap...
                </>
              ) : (
                "Swap Privately"
              )
            ) : isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {needsApproval ? "Approving..." : "Swapping..."}
              </>
            ) : needsApproval ? (
              "Approve and Swap ppUSD"
            ) : (
              "Swap"
            )}
          </Button>
        </CardContent>
      </Card>

      <Faucet />
    </div>
  );
}
