import fs from "fs";
import path from "path";
import { poseidonHashBN254, init } from "garaga";
import { MAX_120_BIT, parseBigInt, toHex32, randomField } from "./utils";

async function main() {
  await init();
  const amountArg = process.argv[2];
  const outPathArg = process.argv[3];

  if (!amountArg) {
    throw new Error(
      "usage: npx tsx contracts/scripts/generateCommitment.ts <amount_in_pool> [output_json_path]",
    );
  }

  const amount = parseBigInt(amountArg, "amount_in_pool");
  if (amount > MAX_120_BIT) {
    throw new Error("amount_in_pool must fit within 120 bits");
  }

  const nullifier = randomField();
  const secret = randomField();

  const commitment = poseidonHashBN254(
    poseidonHashBN254(nullifier, secret),
    amount,
  );

  const payload = {
    commitment: toHex32(commitment),
    nullifier: toHex32(nullifier),
    secret: toHex32(secret),
    amount_in_pool: toHex32(amount),
  };

  const outputJson = JSON.stringify(payload, null, 2);

  if (outPathArg) {
    const outPath = path.resolve(process.cwd(), outPathArg);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${outputJson}\n`, "utf8");
  }

  process.stdout.write(`${outputJson}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
