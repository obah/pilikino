import Link from "next/link";
import { ArrowRight, Coins, Globe2, ServerCog } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const benefits = [
  {
    title: "Protocol Fees",
    description:
      "Earn STRK relay fees on every private transaction your node verifies and submits.",
    icon: Coins,
  },
  {
    title: "Censorship Resistance",
    description:
      "Help keep Pilikino neutral and permissionless by increasing independent relay capacity.",
    icon: Globe2,
  },
  {
    title: "Low Overhead",
    description:
      "The Rust relayer is lightweight and runs on standard VPS infrastructure with minimal operational load.",
    icon: ServerCog,
  },
];

const steps = [
  {
    title: "Stake",
    body: "Deposit 100 STRK into the Registry contract when registry staking is enabled on your deployment network.",
  },
  {
    title: "Run",
    body: "Start the relayer binary with your RPC, pool address, and signer key to accept and batch requests.",
  },
  {
    title: "Earn",
    body: "Receive relay fees from private actions your node successfully validates and submits on-chain.",
  },
];

export default function NetworkPage() {
  return (
    <main className="bg-background text-foreground min-h-screen transition-colors duration-300">
      <Navbar />

      <section className="px-6 pt-36 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium tracking-[0.16em] text-emerald-400 uppercase">
              Power The Pilikino
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Turn your idle compute into yield. Run a Pilikino Relayer.
            </h1>
            <p className="text-muted-foreground mt-6 text-base leading-relaxed sm:text-lg">
              Operate infrastructure that routes private transactions at scale
              and get paid for keeping the network open and resilient.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/docs/operators/join-relayer-network"
                target="_blank"
                className="bg-foreground text-background inline-flex items-center gap-2 rounded-sm px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                Run a Node
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="glass rounded-xl border border-emerald-500/20 p-6"
              >
                <div className="bg-emerald-500/10 mb-4 inline-flex rounded-lg p-2.5">
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              How Operator Flow Works
            </h2>
            <p className="text-muted-foreground mt-3 text-sm sm:text-base">
              The relayer network is designed so operators have clear economics
              and the protocol gains stronger decentralization over time.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, idx) => (
              <div
                key={step.title}
                className="rounded-xl border border-emerald-500/25 bg-background/60 p-5"
              >
                <p className="text-xs font-semibold tracking-[0.14em] text-emerald-400 uppercase">
                  Step {idx + 1}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/docs/operators/join-relayer-network"
              target="_blank"
              className="border-foreground/30 text-foreground inline-flex items-center gap-2 rounded-sm border px-6 py-3 text-sm font-medium transition-colors hover:border-emerald-400/50 hover:text-emerald-200"
            >
              View Operator Docs
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
