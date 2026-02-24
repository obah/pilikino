"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "./ui/button";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useMemo } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { WalletConnectorModal } from "./WalletConnector";

export const Navbar = () => {
  const { setTheme, theme } = useTheme();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect, isPending: isDisconnectPending } = useDisconnect();

  const pathname = usePathname();
  const isDemo = pathname.includes("/demo");

  const preferredConnector = useMemo(() => connectors[0], [connectors]);

  const triggerIncognito = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isIncognito = theme === "dark";
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Connect Wallet";
  const isWalletBusy = isConnectPending || isDisconnectPending;

  const handleWalletAction = () => {
    if (isConnected) {
      disconnect();
      return;
    }

    if (preferredConnector) {
      connect({ connector: preferredConnector });
    }
  };

  return (
    <nav className="bg-background/50 fixed top-0 right-0 left-0 z-50 px-8 py-5 backdrop-blur-xl">
      <div className="flex items-center justify-between rounded-sm border border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative h-6 w-6">
            <Image
              src="/light-logo.svg"
              alt="Logo"
              fill
              className="block dark:hidden"
              priority
            />
            <Image
              src="/dark-logo.svg"
              alt="Logo"
              fill
              className="hidden dark:block"
              priority
            />
          </span>

          <span className="text-lg font-semibold tracking-tight">Pilikino</span>
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={"/docs"}
            target="_blank"
            className="hover:text-primary rounded-sm px-4 py-2 text-sm font-medium backdrop-blur-xs transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/demo"
            className="hover:text-primary rounded-sm px-4 py-2 text-sm font-medium backdrop-blur-xs transition-colors"
          >
            Demo
          </Link>
          <Link
            href="/network"
            className="hover:text-primary rounded-sm px-4 py-2 text-sm font-medium backdrop-blur-xs transition-colors"
          >
            Relayer
          </Link>
        </div>

        {isDemo ? (
          <div className="flex items-center gap-2">
            <Button
              variant={isIncognito ? "secondary" : "outline"}
              onClick={triggerIncognito}
            >
              {isIncognito ? "Incognito on" : "Incognito off"}
            </Button>
            {/* <Button
              size={"lg"}
              onClick={handleWalletAction}
              className="h-11 px-7"
              disabled={isWalletBusy || (!isConnected && !preferredConnector)}
            >
              {isWalletBusy
                ? "Connecting..."
                : isConnected
                  ? shortAddress
                  : preferredConnector
                    ? "Connect Wallet"
                    : "No Wallet Found"}
            </Button> */}
            <WalletConnectorModal />
          </div>
        ) : (
          <Link
            href="/demo"
            className={buttonVariants({ size: "lg", className: "h-11 px-7" })}
          >
            Try it now <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </nav>
  );
};
