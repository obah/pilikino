"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Clock,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Faucet from "./Faucet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DEMO_CONTRACTS,
  DEMO_RELAYER_CONFIG,
  PRIVATE_DEMO_AMOUNT,
} from "@/lib/demo-config";
import { fetchPoolCommitmentLeavesWithRetry } from "@/lib/pool-leaves";
import { formatTokenAmount, toU256 } from "@/lib/starknet";
import {
  useDeposit,
  useExecuteAction,
} from "pilikino/hooks";
import type {
  NormalTransactionReporter,
  PrivateTransactionReporter,
} from "./transaction-log-types";
import { useAccount, useProvider } from "@starknet-react/core";
import { CallData, hash } from "starknet";

type ProposalStatus = "Active" | "Passed" | "Failed" | "Executed" | "Closed";

const statusMap: Record<number, ProposalStatus> = {
  0: "Active",
  1: "Passed",
  2: "Failed",
  3: "Executed",
  4: "Closed",
};

const PRIVATE_VOTE_AMOUNT = PRIVATE_DEMO_AMOUNT;

interface DaoDemoContentProps {
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

function computeActionIdFromSecret(secret: string): bigint {
  return BigInt(hash.solidityUint256PackedKeccak256([BigInt(secret)]));
}

export default function DaoDemoContent({
  isIncognito,
  onNormalTransaction,
  onPrivateTransaction,
}: DaoDemoContentProps) {
  const { provider } = useProvider();
  const [proposalCount, setProposalCount] = useState(0);

  const refreshProposalCount = useCallback(async () => {
    try {
      const response = await provider.callContract({
        contractAddress: DEMO_CONTRACTS.DemoDao,
        entrypoint: "get_proposal_count",
        calldata: [],
      });
      setProposalCount(Number(response[0] ?? 0));
    } catch {
      setProposalCount(0);
    }
  }, [provider]);

  useEffect(() => {
    void refreshProposalCount();
    const interval = setInterval(() => {
      void refreshProposalCount();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshProposalCount]);

  return (
    <div className="grid gap-6">
      <div className="space-y-6">
        {proposalCount > 0 ? (
          Array.from({ length: proposalCount }).map((_, i) => (
            <ProposalCard
              key={i + 1}
              id={i + 1}
              isIncognito={isIncognito}
              onNormalTransaction={onNormalTransaction}
              onPrivateTransaction={onPrivateTransaction}
            />
          ))
        ) : (
          <Card className="border border-emerald-500/35 bg-transparent shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_12px_28px_-22px_rgba(16,185,129,0.45)] backdrop-blur-sm dark:border-emerald-500/30 dark:bg-[radial-gradient(circle_at_top,#123223_0%,#070d0a_46%,#040806_100%)] dark:shadow-[0_0_0_1px_rgba(16,185,129,0.1),0_20px_40px_-28px_rgba(16,185,129,0.9)]">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Info className="mb-4 h-12 w-12 text-emerald-700/80 dark:text-emerald-200/75" />
              <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                No Active Proposals
              </h3>
              <p className="mt-2 max-w-sm text-emerald-800/80 dark:text-emerald-100/70">
                There are currently no proposals in the DAO.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="mt-8">
        <Faucet />
      </div>
    </div>
  );
}

interface ProposalCardProps {
  id: number;
  isIncognito: boolean;
  onNormalTransaction?: NormalTransactionReporter;
  onPrivateTransaction?: PrivateTransactionReporter;
}

function ProposalCard({
  id,
  isIncognito,
  onNormalTransaction,
  onPrivateTransaction,
}: ProposalCardProps) {
  const { address, account } = useAccount();
  const { provider } = useProvider();

  const [isPrivatePending, setIsPrivatePending] = useState(false);
  const [isNormalPending, setIsNormalPending] = useState(false);
  const [proposalData, setProposalData] = useState<Array<string> | null>(null);
  const [voteData, setVoteData] = useState<Array<string> | null>(null);
  const [ppUSDBalance, setPpUSDBalance] = useState<bigint | null>(null);
  const [pendingVoteSupport, setPendingVoteSupport] = useState<number | null>(null);

  const { deposit } = useDeposit({
    poolAddress: DEMO_CONTRACTS.PilikinoPool,
    provider,
    account,
  });

  const { executeAction } = useExecuteAction({
    poolAddress: DEMO_CONTRACTS.PilikinoPool,
    provider,
    account,
    relayer: DEMO_RELAYER_CONFIG,
  });

  const refreshProposalData = useCallback(async () => {
    try {
      const response = await provider.callContract({
        contractAddress: DEMO_CONTRACTS.DemoDao,
        entrypoint: "get_proposal",
        calldata: [id.toString()],
      });
      setProposalData(response.map((value) => value.toString()));
    } catch {
      setProposalData(null);
    }
  }, [id, provider]);

  const refreshVoteData = useCallback(async () => {
    try {
      const response = await provider.callContract({
        contractAddress: DEMO_CONTRACTS.DemoDao,
        entrypoint: "get_proposal_votes",
        calldata: [id.toString()],
      });
      setVoteData(response.map((value) => value.toString()));
    } catch {
      setVoteData(null);
    }
  }, [id, provider]);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setPpUSDBalance(null);
      return;
    }

    try {
      const response = await provider.callContract({
        contractAddress: DEMO_CONTRACTS.ppUSD,
        entrypoint: "balance_of",
        calldata: [address],
      });
      setPpUSDBalance(parseU256(response));
    } catch {
      setPpUSDBalance(null);
    }
  }, [address, provider]);

  useEffect(() => {
    void refreshProposalData();
    void refreshVoteData();
    void refreshBalance();

    const interval = setInterval(() => {
      void refreshProposalData();
      void refreshVoteData();
      void refreshBalance();
    }, 3000);

    return () => clearInterval(interval);
  }, [refreshProposalData, refreshVoteData, refreshBalance]);

  const ensurePoolApproval = useCallback(async () => {
    if (!account || !address) {
      throw new Error("Wallet not connected");
    }

    const allowanceResponse = await provider.callContract({
      contractAddress: DEMO_CONTRACTS.ppUSD,
      entrypoint: "allowance",
      calldata: [address, DEMO_CONTRACTS.PilikinoPool],
    });

    const allowance = parseU256(allowanceResponse);
    if (allowance >= PRIVATE_VOTE_AMOUNT) {
      return;
    }

    const approveTx = await account.execute({
      contractAddress: DEMO_CONTRACTS.ppUSD,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: DEMO_CONTRACTS.PilikinoPool,
        amount: toU256(PRIVATE_VOTE_AMOUNT),
      }),
    });

    await provider.waitForTransaction(approveTx.transaction_hash);
  }, [account, address, provider]);

  const handleVote = async (support: number) => {
    if (!account || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (isIncognito) {
      setPendingVoteSupport(support);
      setIsPrivatePending(true);

      try {
        await ensurePoolApproval();

        const depositResult = await deposit({
          token: DEMO_CONTRACTS.ppUSD,
          amountInPool: PRIVATE_VOTE_AMOUNT,
          account,
          metadata: { source: "dao", proposalId: id, support },
        });

        onPrivateTransaction?.({
          hash: depositResult.txHash,
          source: "dao",
          methodHint: "deposit",
          parametersHint: `token=${DEMO_CONTRACTS.ppUSD}, amount=${PRIVATE_VOTE_AMOUNT.toString()}`,
          privacyLevel: "Private",
          metadata: {
            initiator: address,
            gasPayer: address,
            method: "deposit",
            parameters: `token=${DEMO_CONTRACTS.ppUSD}, amount=${PRIVATE_VOTE_AMOUNT.toString()}`,
            status: "success",
            noteCommitment: depositResult.commitment,
          },
        });

        const leaves = await fetchPoolCommitmentLeavesWithRetry(
          provider,
          DEMO_CONTRACTS.PilikinoPool,
          depositResult.commitment,
        );

        const executeResult = await executeAction({
          token: DEMO_CONTRACTS.ppUSD,
          amountToWithdraw: PRIVATE_VOTE_AMOUNT,
          target: DEMO_CONTRACTS.DemoDao,
          selector: hash.getSelectorFromName("vote"),
          actionCalldata: [BigInt(id), BigInt(support)],
          actionId: computeActionIdFromSecret(depositResult.secret),
          amountInPool: PRIVATE_VOTE_AMOUNT,
          secret: depositResult.secret,
          nullifier: depositResult.nullifier,
          leaves,
          account,
        });

        onPrivateTransaction?.({
          hash: executeResult.txHash,
          source: "dao",
          methodHint: "executeAction(vote)",
          parametersHint: `proposalId=${id}, support=${support}`,
          privacyLevel: "Private",
          metadata: {
            initiator: address,
            gasPayer: executeResult.relayRequestId ? "relayer" : address,
            method: "vote",
            parameters: `proposalId=${id}, support=${support}`,
            status: executeResult.relayRequestId ? "pending" : "success",
            noteCommitment: executeResult.proof.newCommitment,
            relayRequestId: executeResult.relayRequestId,
            relayQueueLength: executeResult.relayQueueLength,
            relayGasEstimate: executeResult.relayGasEstimate,
            relayMinRequiredFeeWei: executeResult.relayMinRequiredFeeWei,
          },
        });

        toast.success("Private vote cast successfully!");
        await refreshProposalData();
        await refreshVoteData();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Private vote failed";
        toast.error(`Private vote failed: ${message}`);
      } finally {
        setIsPrivatePending(false);
      }
      return;
    }

    setPendingVoteSupport(support);
    setIsNormalPending(true);
    try {
      const tx = await account.execute({
        contractAddress: DEMO_CONTRACTS.DemoDao,
        entrypoint: "vote",
        calldata: [id.toString(), support.toString()],
      });

      onNormalTransaction?.({
        hash: toHexTxHash(tx.transaction_hash),
        source: "dao",
        methodHint: "vote",
        parametersHint: `proposalId=${id}, support=${support}`,
        privacyLevel: "Public",
        initiator: address,
        gasPayer: address,
      });

      await provider.waitForTransaction(tx.transaction_hash);
      toast.success("Vote cast successfully!");
      await refreshProposalData();
      await refreshVoteData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vote failed";
      toast.error(`Vote failed: ${message}`);
    } finally {
      setIsNormalPending(false);
    }
  };

  if (!proposalData || !voteData) return null;

  const target = proposalData[1] ?? "0x0";
  const endTime = Number(proposalData[6] ?? 0);
  const status = Number(proposalData[7] ?? 0);

  const forVotes = parseU256(voteData, 0);
  const againstVotes = parseU256(voteData, 2);
  const abstainVotes = parseU256(voteData, 4);

  const statusText = statusMap[status] || "Unknown";
  const title = `Proposal #${id}`;
  const description = `Execute call to ${target.slice(0, 6)}...${target.slice(-4)}`;
  const isPending = isIncognito ? isPrivatePending : isNormalPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border border-emerald-500/35 bg-transparent transition-colors shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_12px_28px_-22px_rgba(16,185,129,0.45)] backdrop-blur-sm dark:border-emerald-500/30 dark:bg-[radial-gradient(circle_at_top,#123223_0%,#070d0a_46%,#040806_100%)] dark:shadow-[0_0_0_1px_rgba(16,185,129,0.1),0_20px_40px_-28px_rgba(16,185,129,0.9)]">
        <CardContent className="rounded-md border border-emerald-500/30 p-6 dark:border-emerald-400/30">
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusText === "Active"
                          ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/45 dark:bg-emerald-500/15 dark:text-emerald-200"
                          : statusText === "Passed"
                            ? "border-lime-500/45 bg-lime-500/10 text-lime-800 dark:border-lime-300/40 dark:bg-lime-400/10 dark:text-lime-100"
                            : "border-emerald-500/35 bg-emerald-500/5 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-400/5 dark:text-emerald-100/75",
                      )}
                    >
                      {statusText}
                    </span>

                    <span className="flex items-center gap-1 text-xs text-emerald-800/80 dark:text-emerald-100/65">
                      <Clock size={12} /> Ends{" "}
                      {endTime > 0 ? new Date(endTime * 1000).toLocaleDateString() : "-"}
                    </span>

                    {address && ppUSDBalance !== null && (
                      <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100/85">
                        <span className="font-medium">Balance:</span>{" "}
                        {formatTwoDecimals(ppUSDBalance)} ppUSD
                      </p>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-50">
                    {title}
                  </h3>
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-emerald-800/85 dark:text-emerald-100/75">
                {description}
              </p>

              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200/90">
                  <ThumbsUp size={16} />
                  <span>{forVotes.toString()} For</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-200/90">
                  <ThumbsDown size={16} />
                  <span>{againstVotes.toString()} Against</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-700/80 dark:text-emerald-100/65">
                  <MinusCircle size={16} />
                  <span>{abstainVotes.toString()} Abstain</span>
                </div>
              </div>
            </div>

            <div className="flex min-w-[140px] flex-col justify-center gap-3 border-t border-emerald-500/35 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6 dark:border-emerald-500/25">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-emerald-500/45 bg-emerald-500/10 text-emerald-800 hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:text-emerald-900 disabled:opacity-50 dark:border-emerald-400/35 dark:text-emerald-100 dark:hover:border-emerald-300/60 dark:hover:text-emerald-50"
                onClick={() => handleVote(1)}
                disabled={isPending || statusText !== "Active"}
              >
                {isPending && pendingVoteSupport === 1 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp size={16} />
                )}
                Vote For
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-rose-500/45 bg-rose-500/10 text-rose-700 hover:border-rose-500/60 hover:bg-rose-500/20 hover:text-rose-800 disabled:opacity-50 dark:border-rose-400/35 dark:text-rose-100 dark:hover:border-rose-300/60 dark:hover:text-rose-50"
                onClick={() => handleVote(0)}
                disabled={isPending || statusText !== "Active"}
              >
                {isPending && pendingVoteSupport === 0 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown size={16} />
                )}
                Vote Against
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-emerald-500/45 bg-emerald-500/10 text-emerald-800 hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:text-emerald-900 disabled:opacity-50 dark:border-emerald-400/35 dark:text-emerald-100 dark:hover:border-emerald-300/60 dark:hover:text-emerald-50"
                onClick={() => handleVote(2)}
                disabled={isPending || statusText !== "Active"}
              >
                {isPending && pendingVoteSupport === 2 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MinusCircle size={16} />
                )}
                Abstain
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-100/65">
            This is a demo, you can vote several times, claim more ppUSD below
            to vote more
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
