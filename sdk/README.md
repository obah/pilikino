# Pilikino SDK (Starknet)

Core TypeScript SDK for Pilikino.

## Features

- Starknet-native contract interactions (`starknet` v9)
- Garaga BN254 Poseidon for commitments/Merkle logic
- Noir + BB proof generation
- Garaga ZK-Honk calldata generation for Cairo verifier
- Built-in relayer transport (default: `https://pilikino-relayer.onrender.com`)
- React hooks module for common flows

## Quick usage

```ts
import { RpcProvider, Account } from "starknet";
import { PilikinoSDK } from "pilikino";

const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL! });
const account = new Account(
  provider,
  process.env.ACCOUNT_ADDRESS!,
  process.env.PRIVATE_KEY!,
);

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
import {
  useDeposit,
  useWithdraw,
  useExecuteAction,
  useRelayStatus,
} from "pilikino/hooks";
```

- `useDeposit`
- `useWithdraw`
- `useExecuteAction`
- `useRelayStatus`
- `useLocalNotes`
- `usePilikino`
