import { Fr } from "@aztec/foundation/curves/bn254";
import { BN254_FR, MAX_248_BIT, U256_MAX } from "./constants";

export type Uint256Like = { low: bigint; high: bigint };

export function parseBigInt(value: string | number | bigint, label: string): bigint {
  try {
    if (typeof value === "bigint") {
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        throw new Error(`${label} number is not a safe integer`);
      }
      return BigInt(value);
    }
    return BigInt(value);
  } catch {
    throw new Error(`invalid ${label}: ${String(value)}`);
  }
}

export function toBigIntValue(value: unknown, label: string): bigint {
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "string") {
    return parseBigInt(value as string | number | bigint, label);
  }

  if (value instanceof Uint8Array) {
    const hex = Buffer.from(value).toString("hex");
    return BigInt(`0x${hex}`);
  }

  throw new Error(`unsupported ${label} type: ${typeof value}`);
}

export function normalizeField(value: bigint, label: string): bigint {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative`);
  }
  if (value >= BN254_FR) {
    throw new Error(`${label} exceeds BN254 field`);
  }
  return value;
}

export function normalizeU256(value: bigint, label: string): bigint {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative`);
  }
  if (value > U256_MAX) {
    throw new Error(`${label} exceeds u256`);
  }
  return value;
}

export function assertMax248Bits(value: bigint, label: string): bigint {
  if (value < 0n || value > MAX_248_BIT) {
    throw new Error(`${label} must fit within 248 bits`);
  }
  return value;
}

export function toHex32(value: bigint): string {
  const normalized = normalizeU256(value, "value");
  return `0x${normalized.toString(16).padStart(64, "0")}`;
}

export function hexToDecString(hex: string): string {
  return BigInt(hex).toString();
}

export function randomField(): bigint {
  return BigInt(Fr.random().toString());
}

export function splitU256(value: bigint): Uint256Like {
  const normalized = normalizeU256(value, "u256 value");
  const mask128 = (1n << 128n) - 1n;
  return {
    low: normalized & mask128,
    high: normalized >> 128n,
  };
}

export function flattenFieldsAsArray(fields: unknown[]): Uint8Array {
  const chunks = fields.map((field, i) => {
    const n = toBigIntValue(field, `publicInputs[${i}]`);
    const hex = n.toString(16).padStart(64, "0");
    return Uint8Array.from(Buffer.from(hex, "hex"));
  });

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

export function u256ToCalldata(value: bigint): [string, string] {
  const { low, high } = splitU256(value);
  return [low.toString(), high.toString()];
}

export function feltToBool(value: string | bigint): boolean {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return v !== 0n;
}

export function u256FromCallResult(result: string[]): bigint {
  if (result.length < 2) {
    throw new Error("u256 call result must contain at least 2 felts");
  }
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return (high << 128n) + low;
}

export function txHashFromResponse(response: Record<string, unknown>): string {
  const txHash =
    response.transaction_hash ?? response.transactionHash ?? response.tx_hash ?? response.txHash;

  if (typeof txHash === "string") {
    return txHash;
  }
  if (typeof txHash === "bigint") {
    return `0x${txHash.toString(16)}`;
  }

  throw new Error("unable to resolve transaction hash from execute response");
}

export function bytesFromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error("hex string length must be even");
  }
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}
