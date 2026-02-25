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
    <main className="bg-background text-primary relative min-h-screen transition-colors duration-300">
      <div className="bg-primary/5 from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))]" />
      <div className="relative z-20">
        <Navbar />
      </div>

      <section className="relative z-10 px-6 pt-36 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="neon-text text-sm font-bold tracking-[0.16em] uppercase">
              Power The Pilikino
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Turn your idle compute into yield. Run a Pilikino Relayer.
            </h1>
            <p className="text-primary/70 mt-6 font-mono text-base leading-relaxed sm:text-lg">
              Operate infrastructure that routes private transactions at scale
              and get paid for keeping the network open and resilient.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/docs/operators/join-relayer-network"
                target="_blank"
                className="group border-primary bg-primary/10 text-primary hover:bg-primary/20 relative flex items-center gap-2 overflow-hidden rounded-sm border px-8 py-3 text-sm font-bold tracking-widest uppercase transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
              >
                <span className="relative z-10">Run a Node</span>
                <ArrowRight
                  size={18}
                  className="relative z-10 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="group text-card-foreground border-primary/20 hover:border-primary/50 relative z-10 cursor-default rounded-xl border bg-black/40 p-6 shadow-[0_0_15px_rgba(34,197,94,0.05)] backdrop-blur-md transition-all hover:bg-black/60 hover:shadow-[0_0_25px_rgba(34,197,94,0.15)]"
              >
                <div className="bg-primary/10 group-hover:bg-primary/20 mb-4 inline-flex rounded-lg p-2.5 transition-colors">
                  <Icon className="text-primary h-6 w-6 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] transition-transform group-hover:scale-110" />
                </div>
                <h2 className="text-primary/90 text-lg font-bold tracking-wide uppercase">
                  {title}
                </h2>
                <p className="text-primary/60 group-hover:text-primary/80 mt-2 font-mono text-sm leading-relaxed transition-colors">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-24">
        <div className="border-primary/20 mx-auto max-w-6xl rounded-2xl border bg-black/40 p-8 shadow-[0_0_15px_rgba(34,197,94,0.05)] backdrop-blur-md sm:p-10">
          <div className="mb-8">
            <h2 className="neon-text text-2xl font-bold tracking-widest uppercase sm:text-3xl">
              How Operator Flow Works
            </h2>
            <p className="text-primary/70 mt-3 font-mono text-sm sm:text-base">
              The relayer network is designed so operators have clear economics
              and the protocol gains stronger decentralization over time.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, idx) => (
              <div
                key={step.title}
                className="group border-primary/20 bg-background/60 hover:border-primary/50 rounded-xl border p-5 transition-all hover:bg-black/60"
              >
                <p className="text-primary group-hover:text-primary/90 font-mono text-xs font-bold tracking-[0.14em] uppercase transition-colors">
                  Step {idx + 1}
                </p>
                <h3 className="text-primary/90 mt-2 text-lg font-bold tracking-wide uppercase">
                  {step.title}
                </h3>
                <p className="text-primary/60 group-hover:text-primary/80 mt-2 font-mono text-sm leading-relaxed transition-colors">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/docs/operators/join-relayer-network"
              target="_blank"
              className="group border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/80 relative inline-flex items-center gap-2 overflow-hidden rounded-sm border bg-transparent px-6 py-3 text-sm font-bold tracking-widest uppercase transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]"
            >
              <span className="relative z-10">View Operator Docs</span>
              <ArrowRight
                size={16}
                className="relative z-10 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
