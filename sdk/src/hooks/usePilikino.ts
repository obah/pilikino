import { useMemo } from "react";
import type { AccountInterface, ProviderInterface } from "starknet";
import {
  PilikinoSDK,
  type ProofArtifacts,
  type RelayerTransportConfig,
} from "../core";

export interface UsePilikinoOptions {
  provider: ProviderInterface | null;
  account?: AccountInterface | null;
  poolAddress?: string;
  proofArtifacts?: Partial<ProofArtifacts>;
  relayer?: RelayerTransportConfig | null;
}

export interface PilikinoContext {
  sdk: PilikinoSDK | null;
  provider: ProviderInterface | null;
  account: AccountInterface | null;
  isReady: boolean;
}

export function usePilikino(options: UsePilikinoOptions): PilikinoContext {
  const { provider, account, poolAddress, proofArtifacts, relayer } = options;

  const sdk = useMemo(() => {
    if (!provider) {
      return null;
    }

    return new PilikinoSDK({
      provider,
      account: account ?? undefined,
      poolAddress,
      proofArtifacts,
      relayer,
    });
  }, [provider, account, poolAddress, proofArtifacts, relayer]);

  return {
    sdk,
    provider,
    account: account ?? null,
    isReady: Boolean(sdk),
  };
}
