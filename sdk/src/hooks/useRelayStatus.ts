import { useCallback, useEffect, useState } from "react";
import type { RelayStatusResponse } from "../core";
import { toError } from "./helpers";
import { usePilikino, type UsePilikinoOptions } from "./usePilikino";

export interface UseRelayStatusOptions extends UsePilikinoOptions {
  requestId?: string;
  enabled?: boolean;
  refetchIntervalMs?: number;
}

export function useRelayStatus(options: UseRelayStatusOptions) {
  const { requestId, enabled = true, refetchIntervalMs = 0, ...contextOptions } = options;
  const { sdk } = usePilikino(contextOptions);

  const [data, setData] = useState<RelayStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!sdk) {
      throw new Error("PilikinoSDK is not initialized.");
    }
    if (!requestId) {
      throw new Error("requestId is required to fetch relay status.");
    }

    setIsLoading(true);
    setError(null);
    try {
      const status = await sdk.getRelayStatus(requestId);
      setData(status);
      return status;
    } catch (caughtError) {
      const nextError = toError(caughtError);
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [sdk, requestId]);

  useEffect(() => {
    if (!enabled || !requestId || !sdk) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    void refetch();

    if (refetchIntervalMs > 0) {
      intervalId = setInterval(() => {
        void refetch();
      }, refetchIntervalMs);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enabled, requestId, sdk, refetch, refetchIntervalMs]);

  return {
    data,
    isLoading,
    error,
    refetch,
    sdk,
  };
}
