import { poseidonHashBN254, init } from "garaga";
import { parseBigInt, toHex32 } from "./utils";

function stringToBigInt(str: string): bigint {
  try {
    // If it's a valid hex or decimal number that fits in the field
    return parseBigInt(str, "input");
  } catch (e) {
    // Otherwise, convert the string characters into a BigInt
    const hex = Buffer.from(str, "utf8").toString("hex");
    return BigInt("0x" + hex);
  }
}

async function main() {
  await init();
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error(
      "Usage: npx tsx contracts/scripts/generateHashChain.ts <string>",
    );
    process.exit(1);
  }

  let currentHash = stringToBigInt(inputArg);

  const hashes: string[] = [];
  hashes.push(toHex32(currentHash));

  for (let i = 0; i < 31; i++) {
    // Hashing the value with itself (commonly used to generate Merkle tree zero-values).
    // If you instead want to hash against 0, change the second argument to 0n.
    currentHash = poseidonHashBN254(currentHash, currentHash);
    hashes.push(toHex32(currentHash));
  }

  console.log("\nGenerated Chain of 30 Hashes:");
  console.log("[\n  " + hashes.map((h) => `"${h}"`).join(",\n  ") + "\n]");
}

main();
