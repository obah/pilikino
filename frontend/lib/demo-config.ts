import { DEFAULT_RELAYER_TRANSPORT_CONFIG } from "pilikino/core";

export const DEMO_CONTRACTS = {
  PilikinoPool:
    process.env.NEXT_PUBLIC_PILIKINO_POOL_ADDRESS ??
    "0x0719784b7a7c45247a9405d7f6acf25d5506423ab31f4af22c4c9613ee40b94d",
  DemoDao:
    process.env.NEXT_PUBLIC_DEMO_DAO_ADDRESS ??
    "0x057a61a78695df5efab39c679ffdc13462cabc828459e8272eb0fda38091ec90",
  DemoDefi:
    process.env.NEXT_PUBLIC_DEMO_DEFI_ADDRESS ??
    "0x076ffb2b056ee0d1a401c3830fb2c7ba0a7e5e1d41783d37afa2e4ae6d8f16af",
  ppUSD:
    process.env.NEXT_PUBLIC_PPUSD_ADDRESS ??
    "0x03fd8e1ce6a31ff8b58f2ba74fbd9e3ea217aef2a92bed955b546ea280e43849",
  USDTpp:
    process.env.NEXT_PUBLIC_USDTPP_ADDRESS ??
    "0x01e9a4b699d71fd7d6c474d009b0eec7230e03bd7e67199b0ec5a3ce161ade8e",
} as const;

export const STARKNET_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_STARKNET_EXPLORER_URL ??
  "https://sepolia.voyager.online";

export const DEMO_RELAYER_URL =
  process.env.NEXT_PUBLIC_PILIKINO_RELAYER_URL ??
  process.env.NEXT_PUBLIC_PRIVACY_PROTOCOL_RELAYER_URL ??
  DEFAULT_RELAYER_TRANSPORT_CONFIG.url;

export const DEMO_RELAYER_ENDPOINT =
  process.env.NEXT_PUBLIC_PILIKINO_RELAYER_ENDPOINT ??
  process.env.NEXT_PUBLIC_PRIVACY_PROTOCOL_RELAYER_ENDPOINT ??
  DEFAULT_RELAYER_TRANSPORT_CONFIG.endpoint;

export const DEMO_RELAYER_CONFIG = {
  url: DEMO_RELAYER_URL,
  endpoint: DEMO_RELAYER_ENDPOINT,
};

export const DECIMALS = BigInt(18);
export const ONE_TOKEN = BigInt(10) ** DECIMALS;
export const FAUCET_AMOUNT = BigInt(1000) * ONE_TOKEN;
export const PRIVATE_DEMO_AMOUNT = BigInt(10) * ONE_TOKEN;

// Kept for compatibility with any legacy imports while the demo is fully Starknet-native.
export const ERC20_ABI = [] as const;
export const DEMO_DAO_ABI = [] as const;
export const DEMO_DEFI_ABI = [] as const;
