"use client";

import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  voyager,
  cartridgeProvider,
  Connector,
} from "@starknet-react/core";
import { InjectedConnector } from "starknetkit/injected";

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  // const { connectors } = useInjectedConnectors({
  //   // Show these connectors if the user has no connector installed.
  //   recommended: [ready(), braavos()],
  //   // Hide recommended connectors if the user has any connector installed.
  //   includeRecommended: "onlyIfNoConnectors",
  //   // Randomize the order of the connectors.
  //   order: "random",
  // });

  const connectors = [
    new InjectedConnector({
      options: { id: "argentX", name: "Ready Wallet (formerly Argent)" },
    }),
    new InjectedConnector({
      options: { id: "braavos", name: "Braavos" },
    }),
  ];

  return (
    <StarknetConfig
      chains={[sepolia, mainnet]}
      provider={cartridgeProvider()}
      connectors={connectors as Connector[]}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
