"use client";

import { cn } from "@/lib/utils";
import {
  Download,
  Lock,
  Layers,
  EyeOff,
  ShieldCheck,
  Droplet,
  Zap,
  Puzzle,
  Smile,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

type FeatureType = {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description: string;
};

type FeatureCardPorps = React.ComponentProps<"div"> & {
  feature: FeatureType;
};

function FeatureCard({ feature, className, ...props }: FeatureCardPorps) {
  const p = genRandomPattern();

  return (
    <div className={cn("relative overflow-hidden p-8", className)} {...props}>
      <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full mask-[linear-gradient(white,transparent)]">
        <div className="from-primary/20 to-primary/5 absolute inset-0 bg-linear-to-r mask-[radial-gradient(farthest-side_at_top,white,transparent)] opacity-100 transition-opacity duration-500 group-hover:opacity-100">
          <GridPattern
            width={20}
            height={20}
            x="-12"
            y="4"
            squares={p}
            className="fill-primary/10 stroke-primary/20 absolute inset-0 h-full w-full mix-blend-overlay"
          />
        </div>
      </div>
      <feature.icon
        className="text-primary size-8 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
        strokeWidth={1.5}
        aria-hidden
      />
      <h3 className="text-primary/90 mt-10 text-sm font-bold tracking-wide uppercase md:text-xl">
        {feature.title}
      </h3>
      <p className="text-primary/60 group-hover:text-primary/80 relative z-20 mt-3 font-mono text-sm leading-relaxed transition-colors">
        {feature.description}
      </p>
    </div>
  );
}

function GridPattern({
  width,
  height,
  x,
  y,
  squares,
  ...props
}: React.ComponentProps<"svg"> & {
  width: number;
  height: number;
  x: string;
  y: string;
  squares?: number[][];
}) {
  const patternId = useId();

  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill={`url(#${patternId})`}
      />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([x, y], index) => (
            <rect
              strokeWidth="0"
              key={index}
              width={width + 1}
              height={height + 1}
              x={x * width}
              y={y * height}
            />
          ))}
        </svg>
      )}
    </svg>
  );
}

function genRandomPattern(length?: number): number[][] {
  length = length ?? 5;
  return Array.from({ length }, () => [
    Math.floor(Math.random() * 4) + 7, // random x between 7 and 10
    Math.floor(Math.random() * 6) + 1, // random y between 1 and 6
  ]);
}

const benefits = [
  {
    title: "Ship in Minutes, Not Months",
    icon: Zap,
    description:
      "Skip the steep learning curve of ZK circuits. Integrate enterprise-grade privacy with just few lines of code.",
  },
  {
    title: "Tap Into Deep Liquidity",
    icon: Layers,
    description:
      "Integrate privacy directly in your Starknet dApp without splitting product logic or introducing separate liquidity flows.",
  },
  {
    title: "Audit-Ready Compliance",
    icon: ShieldCheck,
    description:
      "Protect your protocol from regulatory risk with built-in hooks for View Keys and Proof-of-Innocence, preventing illicit usage.",
  },
  {
    title: "Retain User Sovereignty",
    icon: Lock,
    description:
      "Give users what they want: absolute control. By removing centralized provers, you eliminate the single point of failure and trust.",
  },
  {
    title: "Unbroken Composability",
    icon: Puzzle,
    description:
      "Your dApp keeps working exactly as it does today. Swaps, governance actions, and custom contract flows continue to work inside the privacy shield.",
  },
  {
    title: "Zero User Friction",
    icon: Smile,
    description:
      "No more 'withdraw-to-mix' headaches. Users enjoy a fluid experience where privacy is a background feature, not a hurdle.",
  },
];

export default function BenefitsSection() {
  return (
    <section className="relative w-full py-16 md:py-32">
      <div className="bg-primary/5 from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))]" />
      <div className="relative z-10 mx-auto w-full space-y-12 px-4">
        <AnimatedContainer className="mx-auto max-w-3xl text-center">
          <h2 className="neon-text text-3xl font-bold tracking-widest text-balance uppercase md:text-4xl lg:text-5xl">
            Secure. Simple. Seamless.
          </h2>
          <p className="text-primary/70 mt-4 font-mono text-sm tracking-widest text-balance md:text-base">
            Everything you need to easily and efficiently integrate privacy into
            your application.
          </p>
        </AnimatedContainer>

        <AnimatedContainer
          delay={0.4}
          className="divide-primary/20 border-primary/20 grid w-full grid-cols-1 divide-x divide-y border bg-black/40 shadow-[0_0_30px_rgba(34,197,94,0.05)] backdrop-blur-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
        >
          {benefits.map((benefit, i) => (
            <FeatureCard
              key={i}
              feature={benefit}
              className="hover:bg-primary/5 group transition-colors duration-500"
            />
          ))}
        </AnimatedContainer>
      </div>
    </section>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: React.ComponentProps<typeof motion.div>["className"];
  children: React.ReactNode;
};

function AnimatedContainer({
  className,
  delay = 0.1,
  children,
}: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return children;
  }

  return (
    <motion.div
      initial={{ filter: "blur(4px)", translateY: -8, opacity: 0 }}
      whileInView={{ filter: "blur(0px)", translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
