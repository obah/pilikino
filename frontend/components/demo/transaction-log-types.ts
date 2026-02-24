export type DemoTransactionSource = "dao" | "defi";

export interface NormalTransactionEvent {
  hash: `0x${string}`;
  source: DemoTransactionSource;
  methodHint: string;
  parametersHint: string;
  privacyLevel: "Public";
  initiator?: string;
  gasPayer?: string;
}

export type NormalTransactionReporter = (
  transaction: NormalTransactionEvent,
) => void;

export interface PrivateTransactionMetadata {
  initiator?: string;
  gasPayer?: string;
  method?: string;
  methodId?: string;
  parameters?: string;
  status?: "pending" | "success" | "reverted";
  to?: string | null;
  proxyAddress?: string;
  noteCommitment?: string;
  relayRequestId?: string;
  relayTxHash?: string;
  relayQueueLength?: number;
  relayGasEstimate?: string;
  relayMinRequiredFeeWei?: string;
  relaySubmittedAt?: number;
  relayConfirmedAt?: number;
}

export interface PrivateTransactionEvent {
  hash: string;
  source: DemoTransactionSource;
  methodHint: string;
  parametersHint: string;
  privacyLevel: "Private";
  metadata?: PrivateTransactionMetadata;
}

export type PrivateTransactionReporter = (
  transaction: PrivateTransactionEvent,
) => void;
