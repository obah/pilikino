"use client";

import { motion } from "framer-motion";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const steps = [
  {
    number: "01",
    title: "Install and Connect",
    description:
      "Add Pilikino to your Starknet app and connect wallet/account via starknet-react and starknet.js.",
  },
  {
    number: "02",
    title: "Client-Side Proving",
    description:
      "The SDK handles Noir + Garaga proof generation on the client, so private intents are authorized without revealing identity links.",
  },
  {
    number: "03",
    title: "Onchain Verification",
    description:
      "Proofs are verified by the Pilikino pool contract, then approved actions are executed against your target contract.",
  },
  {
    number: "04",
    title: "Composable Settlement",
    description:
      "Standard actions like swaps, votes, and contract calls remain composable while balances stay inside the private note flow.",
  },
];

export function HowItWorksSectionDevs() {
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
            How It Works (For Developers)
          </h2>
          <p className="text-muted-foreground mt-4 text-sm tracking-wide text-balance md:text-base">
            Pilikino is a privacy layer for Starknet applications. It keeps smart
            contract composability intact while enabling private deposits,
            withdrawals, and action execution through zero-knowledge proofs.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-zinc-800 p-2 md:rounded-[1.5rem] md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={3}
                />
                <div className="bg-background relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-[0.75px] border-green-500/20 p-6 shadow-sm md:p-6 dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)]">
                  <div className="relative flex flex-1 flex-col justify-between gap-3">
                    <div className="text-primary/20 mb-4 text-5xl font-bold">
                      {step.number}
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-foreground pt-0.5 font-sans text-xl leading-5.5 font-semibold tracking-[-0.04em] text-balance md:text-xl md:leading-6">
                        {step.title}
                      </h3>
                      <h2 className="text-muted-foreground font-sans text-sm leading-4.5 md:text-base md:leading-5.5 [&_b]:md:font-semibold [&_strong]:md:font-semibold">
                        {step.description}
                      </h2>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
