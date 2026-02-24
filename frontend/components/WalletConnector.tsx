"use client";

import {
  Connector,
  useAccount,
  useConnect,
  useDisconnect,
} from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";

export function WalletConnectorModal() {
  const { disconnect } = useDisconnect();

  const { connect, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });

  async function connectWallet() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) {
      return;
    }
    await connect({ connector: connector as Connector });
  }

  const { address } = useAccount();

  if (!address) {
    return (
      <button
        onClick={connectWallet}
        className="bg-primary hover:bg-primary/80 rounded-lg px-4 py-2 text-sm text-white transition-colors hover:cursor-pointer"
      >
        Connect Wallet
      </button>
    );
  }
  return (
    <button
      onClick={() => disconnect()}
      className="bg-primary hover:bg-primary/80 rounded-lg px-4 py-2 text-sm text-white transition-colors hover:cursor-pointer"
    >
      {address?.slice(0, 6)}...{address?.slice(-4)}
    </button>
  );
}
