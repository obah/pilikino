# Pilikino SDK (Starknet)

Core TypeScript SDK for Pilikino (Starknet privacy pool).

## Features

- Starknet-native contract interactions (`starknet` v9)
- Garaga BN254 Poseidon for commitments/Merkle logic
- Noir + BB proof generation
- Garaga ZK-Honk calldata generation for Cairo verifier
- Built-in relayer transport (default: `https://pilikino-relayer.onrender.com`)
- React hooks module for common flows

## Defaults

The SDK now ships with hardcoded defaults for:

- `poolAddress`: `0x0719784b7a7c45247a9405d7f6acf25d5506423ab31f4af22c4c9613ee40b94d`
- `proofArtifacts.circuit`: bundled from Pilikino circuit target
- `proofArtifacts.verifyingKey`: bundled verifier key
- `relayer.url`: `https://pilikino-relayer.onrender.com`
- `relayer.endpoint`: `/relay`

So `poolAddress` and `proofArtifacts` are optional unless you want to override them.

## Quick usage

```ts
import { RpcProvider, Account } from "starknet";
import { PilikinoSDK } from "./src";

const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL! });
const account = new Account(provider, process.env.ACCOUNT_ADDRESS!, process.env.PRIVATE_KEY!);

const sdk = new PilikinoSDK({
  provider,
  account,
  // Optional overrides:
  // poolAddress: "0x...",
  // proofArtifacts: { circuit, verifyingKey },
  // relayer: { url: "https://pilikino-relayer.onrender.com", endpoint: "/relay" },
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

## Hooks

```ts
import { useDeposit, useWithdraw, useExecuteAction, useRelayStatus } from "./src";
```

- `useDeposit`
- `useWithdraw`
- `useExecuteAction`
- `useRelayStatus`
- `useLocalNotes`
- `usePilikino`

Set `relayer: null` in SDK config to force direct on-chain submission for withdraw/action.
