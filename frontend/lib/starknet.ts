import { CallData, cairo, hash } from "starknet";

export function toU256(value: bigint) {
  return cairo.uint256(value);
}

export function fromU256Words(low: bigint, high: bigint): bigint {
  return low + (high << 128n);
}

export function parseU256Words(words: Array<string | bigint>, startIndex: number): bigint {
  const low = BigInt(words[startIndex] ?? 0);
  const high = BigInt(words[startIndex + 1] ?? 0);
  return fromU256Words(low, high);
}

export function shortAddress(value?: string, start: number = 8, end: number = 6): string {
  if (!value) return "pending...";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function parseAmountInput(value: string): bigint | null {
  if (!value.trim()) return null;
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null;

  const [wholeRaw, fractionalRaw = ""] = value.trim().split(".");
  const whole = BigInt(wholeRaw || "0");
  const fractional = fractionalRaw.slice(0, 18).padEnd(18, "0");
  return whole * 10n ** 18n + BigInt(fractional || "0");
}

export function formatTokenAmount(amount: bigint): string {
  const base = 10n ** 18n;
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : `${whole}`;
}

export function selectorFromName(name: string): string {
  return hash.getSelectorFromName(name);
}

export function compileCalldata(values: unknown) {
  return CallData.compile(values as any);
}
