import { init, poseidonHashBN254 } from "garaga";
import { TREE_HEIGHT, ZERO_VALUES } from "./constants";
import { normalizeField, parseBigInt, toHex32 } from "./utils";

let garagaInitPromise: Promise<unknown> | null = null;

export async function ensureGaragaInit(): Promise<void> {
  if (!garagaInitPromise) {
    garagaInitPromise = init();
  }
  await garagaInitPromise;
}

export async function poseidonHash2(left: bigint, right: bigint): Promise<bigint> {
  await ensureGaragaInit();
  return poseidonHashBN254(
    normalizeField(left, "poseidon left"),
    normalizeField(right, "poseidon right"),
  );
}

export interface MerkleProof {
  root: string;
  pathElements: string[];
  pathIndices: number[];
  leaf: string;
}

export class PoseidonTree {
  private readonly storage = new Map<string, string>();
  private totalLeaves = 0;

  constructor(
    private readonly levels: number,
    private readonly zeros: string[],
  ) {
    if (zeros.length < levels + 1) {
      throw new Error("not enough zero values for tree height");
    }
  }

  async init() {
    // Keep empty: all nodes are implicit zeros.
  }

  private static key(level: number, index: number): string {
    return `${level}-${index}`;
  }

  getIndex(leaf: string): number {
    for (const [key, value] of this.storage.entries()) {
      if (value === leaf && key.startsWith("0-")) {
        return Number(key.split("-")[1]);
      }
    }
    return -1;
  }

  root(): string {
    return (
      this.storage.get(PoseidonTree.key(this.levels, 0)) ?? this.zeros[this.levels]
    );
  }

  async insert(leaf: string): Promise<void> {
    const index = this.totalLeaves;
    await this.update(index, leaf, true);
    this.totalLeaves += 1;
  }

  private async update(index: number, leaf: string, isInsert: boolean): Promise<void> {
    if (!isInsert && index >= this.totalLeaves) {
      throw new Error("cannot update non-existing leaf");
    }

    let currentHash = leaf;
    let currentIndex = index;

    for (let level = 0; level < this.levels; level += 1) {
      this.storage.set(PoseidonTree.key(level, currentIndex), currentHash);

      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const sibling =
        this.storage.get(PoseidonTree.key(level, siblingIndex)) ?? this.zeros[level];

      const [left, right] =
        currentIndex % 2 === 0 ? [currentHash, sibling] : [sibling, currentHash];

      const next = await poseidonHash2(BigInt(left), BigInt(right));
      currentHash = toHex32(next);
      currentIndex = Math.floor(currentIndex / 2);
    }

    this.storage.set(PoseidonTree.key(this.levels, 0), currentHash);
  }

  proof(index: number): MerkleProof {
    const leaf = this.storage.get(PoseidonTree.key(0, index));
    if (!leaf) {
      throw new Error("leaf not found in tree");
    }

    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    let currentIndex = index;
    for (let level = 0; level < this.levels; level += 1) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const sibling =
        this.storage.get(PoseidonTree.key(level, siblingIndex)) ?? this.zeros[level];
      pathElements.push(sibling);
      pathIndices.push(currentIndex % 2);
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      root: this.root(),
      pathElements,
      pathIndices,
      leaf,
    };
  }
}

export async function merkleTree(leaves: Array<string | bigint>): Promise<PoseidonTree> {
  const tree = new PoseidonTree(TREE_HEIGHT, ZERO_VALUES);
  await tree.init();

  for (const leaf of leaves) {
    const parsed = typeof leaf === "string" ? parseBigInt(leaf, "leaf") : leaf;
    await tree.insert(toHex32(normalizeField(parsed, "leaf")));
  }

  return tree;
}
