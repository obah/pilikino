import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const artifactsToCopy = [
  ["src/core/artifacts/circuits.json", "dist/core/artifacts/circuits.json"],
];

for (const [source, target] of artifactsToCopy) {
  const sourcePath = resolve(source);
  const targetPath = resolve(target);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}
