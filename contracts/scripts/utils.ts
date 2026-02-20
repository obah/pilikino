import { Fr } from "@aztec/foundation/curves/bn254";

export const BN254_FR =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const MAX_120_BIT = (1n << 120n) - 1n;
export const MAX_248_BIT = (1n << 248n) - 1n;

export function normalizeField(value: bigint, label: string = "field"): bigint {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative`);
  }
  if (value >= BN254_FR) {
    throw new Error(`${label} exceeds BN254 field`);
  }
  return value;
}

export function parseBigInt(value: string, label: string = "value"): bigint {
  try {
    const parsed = value.startsWith("0x") ? BigInt(value) : BigInt(value);
    return normalizeField(parsed, label);
  } catch {
    throw new Error(`invalid ${label}: ${value}`);
  }
}

export function toHex32(value: bigint): string {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

export function hexToDecString(hex: string): string {
  return BigInt(hex).toString();
}

export function flattenFieldsAsArray(fields: string[]): Uint8Array {
  const chunks = fields.map((f) => {
    const n = BigInt(f);
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

export function splitU256(value: bigint): [bigint, bigint] {
  const mask128 = (1n << 128n) - 1n;
  const low = value & mask128;
  const high = value >> 128n;
  return [low, high];
}

export function randomField(): bigint {
  return BigInt(Fr.random().toString());
}
