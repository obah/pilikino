"use client";

import {
  Connector,
  useAccount,
  useConnect,
  useDisconnect,
} from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";

import { Button } from "@/components/ui/button";

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
      <Button onClick={connectWallet} size="lg" className="h-11 px-7">
        Connect Wallet
      </Button>
    );
  }
  return (
    <Button onClick={() => disconnect()} size="lg" className="h-11 px-7">
      {address?.slice(0, 6)}...{address?.slice(-4)}
    </Button>
  );
}
