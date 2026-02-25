"use client";

import { motion } from "framer-motion";
import { Terminal, Settings, Zap } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const steps = [
  {
    icon: Terminal,
    title: "Install SDK",
    code: `npm i pilikino`,
    description:
      "Install Pilikino with Starknet dependencies. No ethers or wagmi required.",
  },
  {
    icon: Settings,
    title: "Initialize Hooks",
    code: `import { useAccount, useProvider } from "@starknet-react/core";
import { useDeposit, useExecuteAction } from "pilikino/hooks";

const { account } = useAccount();
const { provider } = useProvider();

const config = {
  provider,
  account,
  poolAddress: "0x...", // optional if using SDK default
};

const { deposit } = useDeposit(config);
const { executeAction } = useExecuteAction(config);`,
    description:
      "Pass Starknet provider/account directly. Pool address and relayer config are optional.",
  },
  {
    icon: Zap,
    title: "Use Hooks",
    code: `const [relayId, setRelayId] = useState<string | null>(null);

const { deposit, note, isPending: isDepositing } = useDeposit(config);
const { executeAction, isPending: isExecuting } = useExecuteAction(config);
const { data: relayStatus } = useRelayStatus({
  ...config,
  requestId: relayId,
  enabled: Boolean(relayId),
});

const onPrivateSwap = async () => {
  const created = await deposit({ token, amountInPool: 100n });

  const result = await executeAction({
    token,
    amountToWithdraw: 40n,
    target,
    selector: "swap_simple",
    actionCalldata: [40n],
    amountInPool: 100n,
    secret: created.secret,
    nullifier: created.nullifier,
    leaves,
  });

  if (result.relayRequestId) setRelayId(result.relayRequestId);
};`,
    description:
      "Use Pilikino hooks directly in your component state flow for private actions and relay status tracking.",
  },
];

export function HowToUseSection() {
  return (
    <section className="relative px-6 py-24">
      <div className="bg-background pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="neon-text text-primary mb-4 text-3xl font-bold tracking-widest uppercase sm:text-4xl">
            Quick Start Guide
          </h2>
          <p className="text-primary/70 mx-auto max-w-3xl font-mono text-lg tracking-wide">
            Integrate Pilikino into a Starknet app in a few steps.
          </p>
        </motion.div>

        <div className="space-y-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="border-primary/20 hover:border-primary/50 group relative h-full rounded-xl border bg-black/40 p-2 transition-colors md:p-3"
            >
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div className="bg-background border-primary/20 group-hover:bg-primary/5 group-hover:border-primary/40 relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-lg border p-6 shadow-sm transition-all md:p-6">
                <div className="flex flex-col gap-6 lg:flex-row">
                  <div className="lg:w-1/3">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="bg-primary/10 group-hover:bg-primary/20 flex h-10 w-10 items-center justify-center rounded-xl transition-colors">
                        <step.icon className="text-primary size-6 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] transition-transform group-hover:scale-110" />
                      </div>
                      <span className="text-primary font-mono text-sm font-bold tracking-widest uppercase">
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="text-primary/90 mb-2 text-xl font-bold tracking-wide uppercase">
                      {step.title}
                    </h3>
                    <p className="text-primary/60 group-hover:text-primary/80 font-mono text-sm leading-relaxed transition-colors">
                      {step.description}
                    </p>
                  </div>

                  <div className="lg:w-2/3">
                    <div className="border-primary/20 group-hover:border-primary/40 overflow-x-auto rounded-xl border bg-black/60 p-4 shadow-[0_0_15px_rgba(34,197,94,0.05)] transition-all group-hover:shadow-[0_0_25px_rgba(34,197,94,0.15)]">
                      <pre className="text-primary/80 font-mono text-sm leading-relaxed">
                        <code>{step.code}</code>
                      </pre>
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
