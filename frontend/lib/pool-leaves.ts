import type { ProviderInterface } from "starknet";
import { hash } from "starknet";

const DEPOSIT_EVENT_KEYS = selectorSet([
  "Deposit",
  "contracts::pilikino_pool::PilikinoPool::Deposit",
  "contracts::pilikino_pool::PilikinoPool::Event::Deposit",
]);

const WITHDRAWAL_EVENT_KEYS = selectorSet([
  "Withdrawal",
  "contracts::pilikino_pool::PilikinoPool::Withdrawal",
  "contracts::pilikino_pool::PilikinoPool::Event::Withdrawal",
]);

const ACTION_EXECUTED_EVENT_KEYS = selectorSet([
  "ActionExecuted",
  "contracts::pilikino_pool::PilikinoPool::ActionExecuted",
  "contracts::pilikino_pool::PilikinoPool::Event::ActionExecuted",
]);

const EXECUTE_ACTION_SELECTOR = toHex32(hash.getSelectorFromName("execute_action"));

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function selectorSet(names: string[]): Set<string> {
  const selectors = names.map((name) => toHex32(hash.getSelectorFromName(name)));
  return new Set(selectors);
}

function toHex32(value: string | bigint): string {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

function safeHex32(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return toHex32(value);
  } catch {
    return null;
  }
}

function safeBigInt(value: string | bigint | undefined): bigint | null {
  if (value === undefined) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function asUsize(value: bigint): number | null {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(value);
}

function readU256FromSerialized(words: string[], lowIndex: number): string | null {
  const low = safeBigInt(words[lowIndex]);
  const high = safeBigInt(words[lowIndex + 1]);
  if (low === null || high === null) {
    return null;
  }
  return toHex32((high << 128n) + low);
}

function findSelectorIndex(keys: string[], selectors: Set<string>): number | null {
  for (let i = 0; i < keys.length; i += 1) {
    const normalized = safeHex32(keys[i]);
    if (!normalized) {
      continue;
    }
    if (selectors.has(normalized)) {
      return i;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type EmittedEvent = {
  keys?: string[];
  transaction_hash?: string;
};

type EventPage = {
  events?: EmittedEvent[];
  continuation_token?: string | null;
};

function extractExecuteActionNewCommitmentFromCalldata(
  calldataWords: string[],
  poolAddress: string,
): string | null {
  const words = calldataWords.map((word) => safeBigInt(word));
  if (words.some((word) => word === null)) {
    return null;
  }

  const parsed = words as bigint[];
  if (parsed.length < 2) {
    return null;
  }

  const callCount = asUsize(parsed[0]);
  if (callCount === null) {
    return null;
  }

  const poolAddressWord = BigInt(poolAddress);
  const executeActionSelectorWord = BigInt(EXECUTE_ACTION_SELECTOR);

  // First, support modern account encoding (ExecutionEncoding::New):
  // [calls_len, to, selector, calldata_len, calldata..., ...]
  {
    let cursor = 1;
    let decodedAllCalls = true;

    for (let i = 0; i < callCount; i += 1) {
      if (cursor + 2 >= parsed.length) {
        decodedAllCalls = false;
        break;
      }

      const to = parsed[cursor];
      const selectorWord = parsed[cursor + 1];
      const callDataLen = asUsize(parsed[cursor + 2]);
      if (callDataLen === null) {
        decodedAllCalls = false;
        break;
      }

      const callDataStart = cursor + 3;
      const callDataEnd = callDataStart + callDataLen;
      if (callDataEnd > parsed.length) {
        decodedAllCalls = false;
        break;
      }

      if (to === poolAddressWord && selectorWord === executeActionSelectorWord && callDataLen >= 2) {
        const newCommitmentLow = parsed[callDataEnd - 2];
        const newCommitmentHigh = parsed[callDataEnd - 1];
        return toHex32((newCommitmentHigh << 128n) + newCommitmentLow);
      }

      cursor = callDataEnd;
    }

    if (decodedAllCalls && cursor === parsed.length) {
      return null;
    }
  }

  // Fallback for legacy account encoding:
  // [calls_len, to, selector, data_offset, data_len, ..., flattened_len, flattened_data...]
  const callsStart = 1;
  const callsWidth = callCount * 4;
  const flattenedLenIndex = callsStart + callsWidth;
  if (flattenedLenIndex >= parsed.length) {
    return null;
  }

  const flattenedLen = asUsize(parsed[flattenedLenIndex]);
  if (flattenedLen === null) {
    return null;
  }

  const flattenedStart = flattenedLenIndex + 1;
  const flattenedEnd = flattenedStart + flattenedLen;
  if (flattenedEnd > parsed.length) {
    return null;
  }

  for (let i = 0; i < callCount; i += 1) {
    const callOffset = callsStart + i * 4;
    if (callOffset + 3 >= parsed.length) {
      break;
    }

    const to = parsed[callOffset];
    const selectorWord = parsed[callOffset + 1];
    const dataOffset = asUsize(parsed[callOffset + 2]);
    const dataLen = asUsize(parsed[callOffset + 3]);
    if (dataOffset === null || dataLen === null) {
      continue;
    }

    if (to !== poolAddressWord || selectorWord !== executeActionSelectorWord) {
      continue;
    }

    const callDataStart = flattenedStart + dataOffset;
    const callDataEnd = callDataStart + dataLen;
    if (callDataStart < flattenedStart || callDataEnd > flattenedEnd || dataLen < 2) {
      continue;
    }

    const newCommitmentLow = parsed[callDataEnd - 2];
    const newCommitmentHigh = parsed[callDataEnd - 1];
    return toHex32((newCommitmentHigh << 128n) + newCommitmentLow);
  }

  return null;
}

export async function fetchPoolCommitmentLeaves(
  provider: ProviderInterface,
  poolAddress: string,
): Promise<string[]> {
  const leaves: string[] = [];
  let continuationToken: string | undefined;

  do {
    const page = (await provider.getEvents({
      address: poolAddress,
      from_block: { block_number: 0 },
      to_block: "latest",
      chunk_size: 100,
      continuation_token: continuationToken,
    } as any)) as EventPage;

    for (const event of page.events ?? []) {
      const keys = event.keys ?? [];

      const depositSelectorIndex = findSelectorIndex(keys, DEPOSIT_EVENT_KEYS);
      if (depositSelectorIndex !== null) {
        // Deposit keys after selector: token (felt), commitment.low, commitment.high
        const commitment = readU256FromSerialized(keys, depositSelectorIndex + 2);
        if (commitment) {
          leaves.push(commitment);
        }
        continue;
      }

      const withdrawalSelectorIndex = findSelectorIndex(keys, WITHDRAWAL_EVENT_KEYS);
      if (withdrawalSelectorIndex !== null) {
        // Withdrawal keys after selector: new_commitment.low, new_commitment.high, recipient, token
        const newCommitment = readU256FromSerialized(keys, withdrawalSelectorIndex + 1);
        if (newCommitment) {
          leaves.push(newCommitment);
        }
        continue;
      }

      const actionSelectorIndex = findSelectorIndex(keys, ACTION_EXECUTED_EVENT_KEYS);
      if (actionSelectorIndex !== null && event.transaction_hash) {
        try {
          const tx = (await provider.getTransactionByHash(
            event.transaction_hash as any,
          )) as {
            calldata?: Array<string | bigint>;
          };

          const calldataWords = (tx.calldata ?? []).map((value) => String(value));
          const newCommitment = extractExecuteActionNewCommitmentFromCalldata(
            calldataWords,
            poolAddress,
          );

          if (newCommitment) {
            leaves.push(newCommitment);
          }
        } catch {
          continue;
        }
      }
    }

    continuationToken = page.continuation_token ?? undefined;
  } while (continuationToken);

  return leaves;
}

export async function fetchPoolCommitmentLeavesWithRetry(
  provider: ProviderInterface,
  poolAddress: string,
  requiredCommitment?: string,
  maxAttempts: number = DEFAULT_RETRY_ATTEMPTS,
  delayMs: number = DEFAULT_RETRY_DELAY_MS,
): Promise<string[]> {
  const expected = requiredCommitment ? toHex32(requiredCommitment) : undefined;
  let lastLeaves: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const leaves = await fetchPoolCommitmentLeaves(provider, poolAddress);
    lastLeaves = leaves;

    if (!expected || leaves.includes(expected)) {
      return leaves;
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  if (expected) {
    throw new Error(
      `Unable to find commitment ${expected} in pool history after ${maxAttempts} attempts. Retry and ensure SDK/relayer/frontend all use the same pool address and network.`,
    );
  }

  return lastLeaves;
}
