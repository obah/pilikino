"use client";

import { Button } from "@/components/ui/button";
import DaoDemoContent from "@/components/demo/DaoDemoContent";
import type {
  NormalTransactionEvent,
  NormalTransactionReporter,
  PrivateTransactionEvent,
  PrivateTransactionReporter,
} from "@/components/demo/transaction-log-types";
import {
  DEMO_RELAYER_ENDPOINT,
  DEMO_RELAYER_URL,
  STARKNET_EXPLORER_BASE,
} from "@/lib/demo-config";
import { cn } from "@/lib/utils";
import { ExternalLink, Lock, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProvider } from "@starknet-react/core";

interface NormalTransactionLog extends NormalTransactionEvent {
  id: string;
  createdAt: number;
}

interface PrivateTransactionLog extends PrivateTransactionEvent {
  id: string;
  createdAt: number;
}

const RELAY_STATUS_POLL_MS = 2_000;

function buildRelayStatusUrl(requestId: string): string {
  const endpoint = DEMO_RELAYER_ENDPOINT ?? "/relay";
  const base = DEMO_RELAYER_URL.endsWith("/")
    ? DEMO_RELAYER_URL.slice(0, -1)
    : DEMO_RELAYER_URL;
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  return `${base}${normalizedEndpoint}/${encodeURIComponent(requestId)}`;
}

function truncate(value: string, start: number = 12, end: number = 8): string {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function normalizeTxHash(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("0x")) return value;
  if (/^\d+$/.test(value)) return "0x" + BigInt(value).toString(16);
  return undefined;
}

function truncatePrivateParameters(value: string): string {
  if (!value) return "none";

  if (value.startsWith("0x")) {
    return truncate(value, 32, 12);
  }

  if (value.length > 120) {
    return `${value.slice(0, 96)}...${value.slice(-16)}`;
  }

  return value;
}

function buildNoiseLines(seed: string): string[] {
  const cleaned = seed.replace(/^0x/, "") || "0".repeat(120);
  const repeated = cleaned
    .repeat(Math.ceil(140 / cleaned.length))
    .slice(0, 140);
  return [`0x${repeated.slice(0, 64)}`, `0x${repeated.slice(22, 86)}`];
}

function NoiseBlock({
  seed,
  tone = "emerald",
}: {
  seed: string;
  tone?: "emerald" | "sky";
}) {
  const lines = useMemo(() => buildNoiseLines(seed), [seed]);

  return (
    <div
      className={cn(
        "space-y-1 text-[10px] leading-4 tracking-wide blur-[1.8px] select-none",
        tone === "emerald"
          ? "text-emerald-700/35 dark:text-emerald-300/30"
          : "text-sky-700/35 dark:text-sky-200/30",
      )}
    >
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <p
          className={cn(
            "tracking-[0.15em] uppercase",
            tone === "emerald"
              ? "text-emerald-700/45 dark:text-emerald-200/45"
              : "text-sky-700/45 dark:text-sky-200/45",
          )}
        >
          payload_a
        </p>
        <p>{lines[0]}</p>
      </div>
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <p
          className={cn(
            "tracking-[0.15em] uppercase",
            tone === "emerald"
              ? "text-emerald-700/45 dark:text-emerald-200/45"
              : "text-sky-700/45 dark:text-sky-200/45",
          )}
        >
          payload_b
        </p>
        <p>{lines[1]}</p>
      </div>
    </div>
  );
}

function LogRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-emerald-500/30 py-2 sm:grid-cols-[120px_1fr] sm:items-start sm:gap-3 dark:border-emerald-500/15">
      <p className="text-[11px] tracking-[0.18em] text-emerald-700/70 uppercase dark:text-emerald-200/60">
        {label}
      </p>
      <p className="text-xs break-all text-emerald-900/95 dark:text-emerald-100/95">
        {value}
      </p>
    </div>
  );
}

type LifecycleStepTone = "done" | "active" | "pending" | "error";

function LifecycleStep({
  title,
  tone,
  detail,
}: {
  title: string;
  tone: LifecycleStepTone;
  detail: string;
}) {
  const toneClasses =
    tone === "done"
      ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100"
      : tone === "active"
        ? "border-sky-500/45 bg-sky-500/10 text-sky-900 dark:border-sky-400/45 dark:bg-sky-400/10 dark:text-sky-100"
        : tone === "error"
          ? "border-rose-500/45 bg-rose-500/10 text-rose-900 dark:border-rose-400/45 dark:bg-rose-400/10 dark:text-rose-100"
          : "border-slate-400/35 bg-slate-500/5 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-200";

  return (
    <div className={cn("rounded-lg border px-2.5 py-2", toneClasses)}>
      <p className="text-[10px] tracking-[0.15em] uppercase">{title}</p>
      <p className="mt-1 text-[11px] break-all">{detail}</p>
    </div>
  );
}

function useStarknetTransaction(txHash?: string) {
  const { provider } = useProvider();
  const [transaction, setTransaction] = useState<any>(null);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    const normalizedTxHash = normalizeTxHash(txHash);
    if (!normalizedTxHash) {
      setTransaction(null);
      setReceipt(null);
      return;
    }

    let cancelled = false;

    const fetchTransaction = async () => {
      try {
        const tx = await provider.getTransactionByHash(normalizedTxHash);
        if (!cancelled) {
          setTransaction(tx);
        }
      } catch {
        if (!cancelled) {
          setTransaction(null);
        }
      }
    };

    const fetchReceipt = async () => {
      try {
        const nextReceipt =
          await provider.getTransactionReceipt(normalizedTxHash);
        if (!cancelled) {
          setReceipt(nextReceipt);
        }
      } catch {
        if (!cancelled) {
          setReceipt(null);
        }
      }
    };

    void fetchTransaction();
    void fetchReceipt();

    const interval = setInterval(() => {
      void fetchReceipt();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [provider, txHash]);

  return { transaction, receipt };
}

function getReceiptStatus(receipt: any): "pending" | "success" | "reverted" {
  const rawStatus =
    receipt?.execution_status ??
    receipt?.executionStatus ??
    receipt?.status ??
    "";
  const normalized = String(rawStatus).toLowerCase();

  if (normalized.includes("revert")) {
    return "reverted";
  }
  if (normalized.includes("success") || normalized.includes("succeed")) {
    return "success";
  }

  return "pending";
}

function txSender(transaction: any): string | null {
  return (
    transaction?.sender_address ??
    transaction?.senderAddress ??
    transaction?.from ??
    null
  );
}

function txNoiseSeed(transaction: any, fallback: string): string {
  const calldata = transaction?.calldata;
  if (Array.isArray(calldata) && calldata.length > 0) {
    return calldata.map((value) => String(value)).join("");
  }
  return fallback;
}

function NormalTransactionCard({ log }: { log: NormalTransactionLog }) {
  const { transaction, receipt } = useStarknetTransaction(log.hash);

  const normalizedHash = normalizeTxHash(log.hash) ?? log.hash;
  const initiatorRaw = txSender(transaction) ?? log.initiator ?? "pending...";
  const initiator = initiatorRaw.startsWith("0x")
    ? truncate(initiatorRaw, 10, 8)
    : initiatorRaw;
  const method = log.methodHint;
  const parameters = log.parametersHint || "none";
  const status = getReceiptStatus(receipt);
  const gasPayerRaw = txSender(transaction) ?? log.gasPayer ?? initiatorRaw;
  const gasPayer = gasPayerRaw.startsWith("0x")
    ? truncate(gasPayerRaw, 10, 8)
    : gasPayerRaw;
  const noiseSeed = txNoiseSeed(transaction, log.hash);

  return (
    <article className="border-primary/40 hover:border-primary/60 rounded-2xl border bg-black/40 p-4 shadow-[0_0_15px_rgba(34,197,94,0.1)] backdrop-blur-md transition-all hover:bg-black/60 hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="border-primary/40 bg-primary/10 text-primary rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] uppercase shadow-[0_0_10px_rgba(34,197,94,0.2)]">
          {log.source.toUpperCase()} / {status.toUpperCase()}
        </span>
        <span className="text-primary/70 font-mono">
          {new Date(log.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <NoiseBlock seed={noiseSeed} tone="emerald" />

      <div className="mt-2 space-y-1 font-mono">
        <LogRow label="Initiator" value={initiator} />
        <LogRow label="Gas payer" value={gasPayer} />
        <LogRow label="Method" value={method} />
        <LogRow label="Parameters" value={parameters} />
        <LogRow label="Privacy lvl" value={log.privacyLevel} />
      </div>

      <NoiseBlock seed={log.hash} tone="emerald" />

      <Link
        href={`${STARKNET_EXPLORER_BASE}/tx/${normalizedHash}`}
        target="_blank"
        rel="noreferrer"
        className="text-primary/80 hover:text-primary mt-3 inline-flex items-center gap-1 text-xs font-bold underline-offset-4 transition-all hover:underline hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]"
      >
        View on Voyager
        <ExternalLink size={12} />
      </Link>
    </article>
  );
}

function PrivateTransactionCard({ log }: { log: PrivateTransactionLog }) {
  const onchainHash =
    (log.hash.startsWith("0x") ? log.hash : log.metadata?.relayTxHash) ??
    undefined;
  const { transaction, receipt } = useStarknetTransaction(onchainHash);

  const isRelayed = Boolean(log.metadata?.relayRequestId);
  const chainSender = txSender(transaction);
  const txSenderRaw =
    chainSender ??
    (isRelayed ? "pending..." : (log.metadata?.initiator ?? "pending..."));
  const gasPayerRaw =
    chainSender ??
    log.metadata?.gasPayer ??
    (isRelayed ? "pending..." : txSenderRaw);
  const targetCallerRaw = log.metadata?.proxyAddress;
  const method = log.metadata?.method ?? log.methodHint;
  const parameters = truncatePrivateParameters(
    log.metadata?.parameters ?? log.parametersHint,
  );
  const chainStatus = getReceiptStatus(receipt);
  const status = log.metadata?.status ?? chainStatus;
  const noiseSeed = txNoiseSeed(transaction, log.hash);
  const relayRequestId = log.metadata?.relayRequestId;
  const relayTxHash = onchainHash;
  const relaySubmittedAt = log.metadata?.relaySubmittedAt;
  const relayQueueLength = log.metadata?.relayQueueLength;
  const relayGasEstimate = log.metadata?.relayGasEstimate;
  const relayMinRequiredFeeWei = log.metadata?.relayMinRequiredFeeWei;
  const relayError = log.metadata?.relayError;
  const isRelayFailed = log.metadata?.status === "failed";
  const isRelaySubmitted = Boolean(relayTxHash) && !isRelayFailed;
  const isRelayConfirmed =
    chainStatus === "success" || chainStatus === "reverted";
  const isRelayReverted = chainStatus === "reverted";

  return (
    <article className="rounded-2xl border border-cyan-500/40 bg-black/40 p-4 shadow-[0_0_15px_rgba(6,182,212,0.1)] backdrop-blur-md transition-all hover:border-cyan-500/60 hover:bg-black/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-cyan-400 uppercase shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          {log.source.toUpperCase()} / {status.toUpperCase()}
        </span>
        <span className="font-mono text-cyan-400/70">
          {new Date(log.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <NoiseBlock seed={noiseSeed} tone="sky" />

      <div className="mt-2 space-y-1 font-mono">
        <LogRow label="Tx sender" value={truncate(txSenderRaw, 10, 8)} />
        <LogRow label="Gas payer" value={truncate(gasPayerRaw, 10, 8)} />
        {targetCallerRaw ? (
          <LogRow
            label="Target caller"
            value={truncate(targetCallerRaw, 10, 8)}
          />
        ) : null}
        <LogRow label="Method" value={method} />
        <LogRow label="Parameters" value={parameters} />
        {log.metadata?.noteCommitment ? (
          <LogRow label="Commitment" value={log.metadata.noteCommitment} />
        ) : null}
        {relayRequestId ? (
          <LogRow label="Relay req" value={relayRequestId} />
        ) : null}
        {relayQueueLength !== undefined ? (
          <LogRow label="Relay queue" value={relayQueueLength.toString()} />
        ) : null}
        {relayGasEstimate ? (
          <LogRow label="Relay gas est" value={relayGasEstimate} />
        ) : null}
        {relayMinRequiredFeeWei ? (
          <LogRow label="Relay min fee" value={relayMinRequiredFeeWei} />
        ) : null}
        <LogRow label="Privacy lvl" value={log.privacyLevel} />
      </div>

      {relayRequestId ? (
        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
          <p className="neon-text text-[11px] font-bold tracking-[0.16em] text-cyan-500 uppercase">
            Relay Receipt Lifecycle
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <LifecycleStep title="Queued" tone="done" detail={relayRequestId} />
            <LifecycleStep
              title="Submitted"
              tone={
                isRelayFailed ? "error" : isRelaySubmitted ? "done" : "active"
              }
              detail={
                isRelayFailed
                  ? truncatePrivateParameters(relayError ?? "submission failed")
                  : isRelaySubmitted && relayTxHash
                    ? truncate(relayTxHash, 14, 10)
                    : relaySubmittedAt
                      ? new Date(relaySubmittedAt).toLocaleTimeString()
                      : "waiting for batch submit"
              }
            />
            <LifecycleStep
              title="Confirmed"
              tone={
                isRelayFailed
                  ? "error"
                  : isRelayConfirmed
                    ? isRelayReverted
                      ? "error"
                      : "done"
                    : "pending"
              }
              detail={
                isRelayFailed
                  ? "submission failed"
                  : isRelayConfirmed
                    ? isRelayReverted
                      ? "reverted on-chain"
                      : "confirmed on-chain"
                    : "waiting for confirmation"
              }
            />
          </div>
        </div>
      ) : null}

      <NoiseBlock seed={log.hash} tone="sky" />

      {onchainHash ? (
        <Link
          href={`${STARKNET_EXPLORER_BASE}/tx/${onchainHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-400/80 underline-offset-4 transition-all hover:text-cyan-400 hover:underline hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
        >
          View on Voyager
          <ExternalLink size={12} />
        </Link>
      ) : (
        <p className="mt-3 font-mono text-xs text-cyan-400/70">
          Relayed request queued. On-chain hash will appear after batch submit.
        </p>
      )}
    </article>
  );
}

export default function DemoPage() {
  const [normalLogs, setNormalLogs] = useState<NormalTransactionLog[]>([]);
  const [privateLogs, setPrivateLogs] = useState<PrivateTransactionLog[]>([]);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isIncognito = (resolvedTheme ?? theme) === "dark";

  const triggerIncognito = () => {
    setTheme(isIncognito ? "light" : "dark");
  };

  const onNormalTransaction = useCallback<NormalTransactionReporter>((tx) => {
    setNormalLogs((current) => {
      if (current.some((item) => item.hash === tx.hash)) {
        return current;
      }

      const nextLog: NormalTransactionLog = {
        ...tx,
        id: `${tx.hash}-${Date.now()}`,
        createdAt: Date.now(),
      };

      return [nextLog, ...current].slice(0, 6);
    });
  }, []);

  const onPrivateTransaction = useCallback<PrivateTransactionReporter>((tx) => {
    setPrivateLogs((current) => {
      if (
        current.some(
          (item) => item.hash === tx.hash && item.methodHint === tx.methodHint,
        )
      ) {
        return current;
      }

      const nextLog: PrivateTransactionLog = {
        ...tx,
        id: `${tx.hash}-${tx.methodHint}-${Date.now()}`,
        createdAt: Date.now(),
      };

      return [nextLog, ...current].slice(0, 8);
    });
  }, []);

  useEffect(() => {
    const pendingRelayLogs = privateLogs.filter(
      (log) =>
        log.hash.startsWith("relay:") &&
        log.metadata?.relayRequestId &&
        log.metadata?.status !== "success" &&
        log.metadata?.status !== "failed",
    );

    if (pendingRelayLogs.length === 0) {
      return;
    }

    let cancelled = false;

    const pollRelayStatuses = async () => {
      const updates: Array<
        | { id: string; type: "submitted"; txHash: string }
        | { id: string; type: "failed"; error: string }
      > = [];

      for (const log of pendingRelayLogs) {
        const requestId = log.metadata?.relayRequestId;
        if (!requestId) {
          continue;
        }

        try {
          const response = await fetch(buildRelayStatusUrl(requestId));
          if (!response.ok) {
            if (response.status === 404) {
              updates.push({
                id: log.id,
                type: "failed",
                error:
                  "relay request not found on configured relayer; verify relayer URL/endpoint",
              });
            }
            continue;
          }
          const payload = (await response.json()) as {
            status?: string;
            tx_hash?: string | null;
            error?: string | null;
          };
          if (
            payload.status === "submitted" &&
            payload.tx_hash &&
            payload.tx_hash.startsWith("0x")
          ) {
            updates.push({
              id: log.id,
              type: "submitted",
              txHash: payload.tx_hash,
            });
          } else if (payload.status === "failed") {
            updates.push({
              id: log.id,
              type: "failed",
              error: payload.error ?? "relayer submission failed",
            });
          }
        } catch {
          continue;
        }
      }

      if (cancelled || updates.length === 0) {
        return;
      }

      setPrivateLogs((current) =>
        current.map((log) => {
          const update = updates.find((candidate) => candidate.id === log.id);
          if (!update) {
            return log;
          }

          if (update.type === "failed") {
            return {
              ...log,
              metadata: {
                ...log.metadata,
                status: "failed",
                relayError: update.error,
              },
            };
          }

          return {
            ...log,
            hash: update.txHash,
            metadata: {
              ...log.metadata,
              relayTxHash: update.txHash,
              relaySubmittedAt: Date.now(),
              status: undefined,
            },
          };
        }),
      );
    };

    void pollRelayStatuses();
    const interval = setInterval(() => {
      void pollRelayStatuses();
    }, RELAY_STATUS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [privateLogs]);

  return (
    <main className="bg-background relative min-h-screen w-full overflow-x-hidden">
      <div className="border-primary mt-10 h-10 w-screen border-y"></div>
      <section className="relative z-10 container mx-auto flex flex-col items-start gap-10 px-4 pb-20 lg:flex-row lg:justify-between">
        <div className="w-full lg:w-1/2">
          <div className="mb-10 pt-6">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              Governance
            </h1>
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">
                <p className="text-muted-foreground text-sm">
                  Vote on proposals{" "}
                  {isIncognito ? "privately through Pilikino" : "publicly"}
                </p>
                <Button
                  variant={"link"}
                  className="text-primary h-auto p-0 underline"
                  onClick={triggerIncognito}
                >
                  {isIncognito
                    ? "Turn off incognito mode to vote publicly"
                    : "Turn on incognito mode to vote privately"}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                Claim tokens from the faucet below to get started.
              </p>
            </div>
          </div>
          <div className="min-h-[500px]">
            <DaoDemoContent
              isIncognito={isIncognito}
              onNormalTransaction={onNormalTransaction}
              onPrivateTransaction={onPrivateTransaction}
            />
          </div>
        </div>

        <div className="border-primary/20 hidden self-stretch border-l shadow-[0_0_15px_rgba(34,197,94,0.1)] drop-shadow-[0_0_8px_rgba(34,197,94,0.3)] lg:block"></div>

        <div className="w-full lg:w-1/2">
          <div className="mb-10 pt-6">
            <h1 className="neon-text text-primary mb-2 text-3xl font-bold tracking-widest uppercase">
              Transaction Logs
            </h1>
            <p className="text-primary/70 font-mono text-sm tracking-wide">
              Perform transactions in both public and incogito (private) modes
              to see the difference in metadata.
            </p>
            <Link
              href={STARKNET_EXPLORER_BASE}
              target="_blank"
              rel="noreferrer"
              className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-bold underline underline-offset-4 transition-all hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]"
            >
              Open Voyager
              <ExternalLink size={12} />
            </Link>

            <div className="border-primary/20 text-primary mt-6 space-y-4 rounded-2xl border bg-black/40 p-4 shadow-[0_0_15px_rgba(34,197,94,0.05)] backdrop-blur-md">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <TerminalSquare
                  size={14}
                  className="text-primary drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]"
                />
                <p className="text-primary font-mono font-bold tracking-[0.18em] uppercase">
                  Normal Transactions
                </p>
              </div>

              {normalLogs.length === 0 ? (
                <div className="border-primary/30 bg-primary/5 text-primary/70 rounded-xl border p-4 font-mono text-xs">
                  Perform a vote to see its logs here.
                </div>
              ) : (
                <div className="space-y-3">
                  {normalLogs.map((log) => (
                    <NormalTransactionCard key={log.id} log={log} />
                  ))}
                </div>
              )}

              <div className="border-primary/30 my-4 border-t border-dashed"></div>

              <div className="mb-2 flex items-center gap-2 text-sm">
                <Lock
                  size={14}
                  className="text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]"
                />
                <p className="font-mono font-bold tracking-[0.18em] text-cyan-400 uppercase">
                  Private Transactions
                </p>
              </div>
              <p className="mb-2 font-mono text-xs text-cyan-400/80">
                Perform a vote in incognito mode to see its logs here. Private
                actions are submitted to the relayer and later batched on-chain.
                The relayer pays gas on submission.
              </p>
              {privateLogs.length === 0 ? (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 font-mono text-xs text-cyan-400/70">
                  Perform a private transaction to see its logs here.
                </div>
              ) : (
                <div className="space-y-3">
                  {privateLogs.map((item) => (
                    <PrivateTransactionCard key={item.id} log={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
