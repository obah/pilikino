import { poseidonHashBN254 } from "garaga";
import { toHex32 } from "./utils";

export const TREE_HEIGHT = 20;

export const ZERO_VALUES = [
  "0x00000000000000000000000000000000000000000000000070696c696b696e6f",
  "0x25f9f4c79cf609d6dd68a13c2a50dd645389c45e767812f7a86dd430f583914e",
  "0x1879dcd7016ada23c8574c1f9d33485ec7f0c1cc95cf5f3bda63e2bd998070b2",
  "0x2819cf7c0d16a52e5f307fef73f2a3887cec6e9b815649657f21dab2324e314d",
  "0x0d18bf2bde96b6420dd7daa09fb13a4f976f0b30845c4593efc7cd543bd4c60e",
  "0x1747bcd2c6fd58b64e743a0ce9a885cf13034cdce69a7469f7f615c30d3353cf",
  "0x2ee2fb588d8d9f66c2d445296a38a0d04e1cb0449d2c7358afd83e2000fafd4a",
  "0x0286b6d538d5cff83402522b3b534efcf2e443ad7cc8b2824e24c8466fa11587",
  "0x0f7bff0efb377ffe690c4f2327d75b4c1b0e89e86252850920b022a9fbec9d0c",
  "0x1abd8cb3c853e36142222f01b337fbf80ba1a64dcbac4800a1497d60a3f89f64",
  "0x06e0a70a902f12a11e7ae253812838aff595dd2f2d3527c574a1d55a442fc886",
  "0x152e7c719f65f979a25ec5024bf51b361a62d721f0366f6be2f8f6e4833ca0d6",
  "0x119aa5082892feb65cb6cdab8ceb9bbc7e5f31c3cdbd871a35a48d83b9ce5dad",
  "0x1fcfb07ed93502c78698e1fff295ec2b3c9e05a0dd71fa6cb2a27737b2c0af29",
  "0x137942e92321e476fdc013fa8e1ecfccdf24040f2110bfc4df5446e2e1dcfef1",
  "0x107912e3846b522d5611c27ac620f7e42e2e492c89271eac234264cf283e89f6",
  "0x178e48f6169b2f90f322b6140d1b52909221b93118b860a0be74fbdf27f1b2a4",
  "0x1f96442e7d2399b1118478766c105cf27ad868a30c909f4b52acbb86fee53e87",
  "0x0f785324504391daa39e9664229b706b73705fb4a26aae9b881175cc155452c2",
  "0x26db9172e6f009bdb27b7a1971d6d2080fdefa6fb9cd13e8931522e3b7e93441",
  "0x186fe8795e66e06029e0613cd4e7bc05fd56ef2e27310283e81dfc83907e3601",
];

export type MerkleProof = {
  root: string;
  pathElements: string[];
  pathIndices: number[];
  leaf: string;
};

export class PoseidonTree {
  private readonly storage = new Map<string, string>();
  private totalLeaves = 0;

  constructor(
    private readonly levels: number,
    private readonly zeros: string[],
    private readonly hashLeftRight: (
      left: string,
      right: string,
    ) => Promise<string>,
  ) {
    if (zeros.length < levels + 1) {
      throw new Error("not enough zero values for tree height");
    }
  }

  async init() {
    // keep empty: all nodes are implicit zeros
  }

  private static key(level: number, index: number) {
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
      this.storage.get(PoseidonTree.key(this.levels, 0)) ??
      this.zeros[this.levels]
    );
  }

  async insert(leaf: string) {
    const index = this.totalLeaves;
    await this.update(index, leaf, true);
    this.totalLeaves += 1;
  }

  private async update(index: number, leaf: string, isInsert: boolean) {
    if (!isInsert && index >= this.totalLeaves) {
      throw new Error("cannot update non-existing leaf");
    }

    let currentHash = leaf;
    let currentIndex = index;

    for (let level = 0; level < this.levels; level++) {
      this.storage.set(PoseidonTree.key(level, currentIndex), currentHash);

      const siblingIndex =
        currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const sibling =
        this.storage.get(PoseidonTree.key(level, siblingIndex)) ??
        this.zeros[level];

      const [left, right] =
        currentIndex % 2 === 0
          ? [currentHash, sibling]
          : [sibling, currentHash];

      currentHash = await this.hashLeftRight(left, right);
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
    for (let level = 0; level < this.levels; level++) {
      const siblingIndex =
        currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const sibling =
        this.storage.get(PoseidonTree.key(level, siblingIndex)) ??
        this.zeros[level];
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

export async function merkleTree(leaves: string[]): Promise<PoseidonTree> {
  const hashLeftRight = async (left: string, right: string) => {
    const h = poseidonHashBN254(BigInt(left), BigInt(right));
    return toHex32(h);
  };

  const tree = new PoseidonTree(TREE_HEIGHT, ZERO_VALUES, hashLeftRight);
  await tree.init();

  for (const leaf of leaves) {
    await tree.insert(leaf);
  }

  return tree;
}
