# Pilikino SDK (Starknet)

Core TypeScript SDK for Pilikino (Starknet privacy pool).

## Features

- Starknet-native contract interactions (`starknet` v9)
- Garaga BN254 Poseidon for commitments/Merkle logic
- Noir + BB proof generation
- Garaga ZK-Honk calldata generation for Cairo verifier

## Quick usage

```ts
import { RpcProvider, Account } from "starknet";
import { PilikinoSDK } from "./src";
import circuit from "../../circuits/target/circuits.json";
import fs from "node:fs";

const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL! });
const account = new Account(provider, process.env.ACCOUNT_ADDRESS!, process.env.PRIVATE_KEY!);

const sdk = new PilikinoSDK({
  provider,
  account,
  poolAddress: process.env.POOL_ADDRESS!,
  proofArtifacts: {
    circuit,
    verifyingKey: new Uint8Array(fs.readFileSync("../../circuits/target/vk/vk")),
  },
});

const deposit = await sdk.deposit(process.env.TOKEN_ADDRESS!, 100n);

const withdraw = await sdk.withdraw({
  token: process.env.TOKEN_ADDRESS!,
  recipient: process.env.RECIPIENT!,
  amountToWithdraw: 40n,
  amountInPool: 100n,
  nullifier: deposit.nullifier,
  secret: deposit.secret,
  leaves: [deposit.commitment],
});
```
