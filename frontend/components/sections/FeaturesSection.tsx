"use client";

import { motion } from "framer-motion";
import { Shield, Code, Zap, Lock, RefreshCw, Coins } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const features = [
  {
    icon: Code,
    title: "Universal SDK",
    description:
      "A lightweight npm package that integrates into your existing frontend. No contract changes, no asset migration—just install and wrap your provider.",
  },
  {
    icon: Shield,
    title: "Browser-Native Proving",
    description:
      "Utilizes Aztec's bb.js and Noir to generate SNARKs directly in the browser memory, eliminating the need for trusted server-side proving.",
  },
  {
    icon: Zap,
    title: "Ephemeral Relayer Network",
    description:
      "A decentralized network of relayers that deploy fresh proxy contracts for every transaction, ensuring on-chain unlinkability.",
  },
  {
    icon: RefreshCw,
    title: "Encrypted UTXO State",
    description:
      "Manages user balances using an encrypted Note model, allowing for precise state updates and partial spending.",
  },
  {
    icon: Lock,
    title: "Nullifier Registry",
    description:
      "On-chain storage of spent nullifiers to mathematically prevent double-spending without revealing the spender's identity.",
  },
  {
    icon: Coins,
    title: "Yield-Aware Vaults",
    description:
      "Smart contract vaults that hold the shielded assets and can be extended to earn yield on Aave/Compound while funds sit idle.",
  },
];

export function FeaturesSection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Features
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-white">
            Complete suite of zero-knowledge primitives designed to make privacy
            as standard as a token transfer.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="border-border relative rounded-[1.25rem] border-[0.75px] p-2 md:rounded-[1.5rem] md:p-3"
            >
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div className="bg-background relative flex h-full flex-col gap-6 overflow-hidden rounded-xl border-[0.75px] p-6 shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)]">
                <div className="bg-primary/10 group-hover:bg-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                  <feature.icon className="text-primary size-6" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-foreground mb-2 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
