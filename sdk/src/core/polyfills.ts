type BufferLike = Uint8Array & {
  readBigUInt64BE?(offset?: number): bigint;
  readBigUInt64LE?(offset?: number): bigint;
  readBigUint64BE?(offset?: number): bigint;
  readBigUint64LE?(offset?: number): bigint;
  writeBigUInt64BE?(value: bigint, offset?: number): number;
  writeBigUInt64LE?(value: bigint, offset?: number): number;
  writeBigUint64BE?(value: bigint, offset?: number): number;
  writeBigUint64LE?(value: bigint, offset?: number): number;
};

function assertOffset(target: Uint8Array, offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset + 8 > target.length) {
    throw new RangeError("Offset is outside buffer bounds.");
  }
}

function toUint64(value: bigint): bigint {
  return BigInt.asUintN(64, BigInt(value));
}

function readBigUInt64BE(this: Uint8Array, offset = 0): bigint {
  assertOffset(this, offset);
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value = (value << 8n) | BigInt(this[offset + i]);
  }
  return value;
}

function readBigUInt64LE(this: Uint8Array, offset = 0): bigint {
  assertOffset(this, offset);
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value |= BigInt(this[offset + i]) << (8n * BigInt(i));
  }
  return value;
}

function writeBigUInt64BE(this: Uint8Array, value: bigint, offset = 0): number {
  assertOffset(this, offset);
  let encoded = toUint64(value);
  for (let i = 7; i >= 0; i -= 1) {
    this[offset + i] = Number(encoded & 0xffn);
    encoded >>= 8n;
  }
  return offset + 8;
}

function writeBigUInt64LE(this: Uint8Array, value: bigint, offset = 0): number {
  assertOffset(this, offset);
  let encoded = toUint64(value);
  for (let i = 0; i < 8; i += 1) {
    this[offset + i] = Number(encoded & 0xffn);
    encoded >>= 8n;
  }
  return offset + 8;
}

function defineBufferMethod(
  bufferPrototype: Record<string, unknown>,
  name: string,
  implementation: unknown,
) {
  if (typeof bufferPrototype[name] === "function") {
    return;
  }

  Object.defineProperty(bufferPrototype, name, {
    value: implementation,
    writable: true,
    configurable: true,
  });
}

function installBufferBigIntPolyfill() {
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "readBigUInt64BE",
    readBigUInt64BE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "readBigUInt64LE",
    readBigUInt64LE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "readBigUint64BE",
    readBigUInt64BE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "readBigUint64LE",
    readBigUInt64LE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "writeBigUInt64BE",
    writeBigUInt64BE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "writeBigUInt64LE",
    writeBigUInt64LE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "writeBigUint64BE",
    writeBigUInt64BE,
  );
  defineBufferMethod(
    Uint8Array.prototype as unknown as Record<string, unknown>,
    "writeBigUint64LE",
    writeBigUInt64LE,
  );

  const globalObject = globalThis as { Buffer?: { prototype?: BufferLike } };
  const bufferPrototype = globalObject.Buffer?.prototype as
    | Record<string, unknown>
    | undefined;

  if (!bufferPrototype) {
    return;
  }

  defineBufferMethod(bufferPrototype, "readBigUInt64BE", readBigUInt64BE);
  defineBufferMethod(bufferPrototype, "readBigUInt64LE", readBigUInt64LE);
  defineBufferMethod(bufferPrototype, "readBigUint64BE", readBigUInt64BE);
  defineBufferMethod(bufferPrototype, "readBigUint64LE", readBigUInt64LE);
  defineBufferMethod(bufferPrototype, "writeBigUInt64BE", writeBigUInt64BE);
  defineBufferMethod(bufferPrototype, "writeBigUInt64LE", writeBigUInt64LE);
  defineBufferMethod(bufferPrototype, "writeBigUint64BE", writeBigUInt64BE);
  defineBufferMethod(bufferPrototype, "writeBigUint64LE", writeBigUInt64LE);
}

installBufferBigIntPolyfill();
