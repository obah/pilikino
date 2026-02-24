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
    <div className={cn("relative overflow-hidden p-6", className)} {...props}>
      <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full mask-[linear-gradient(white,transparent)]">
        <div className="absolute inset-0 bg-linear-to-r from-green-500/20 to-green-500/5 mask-[radial-gradient(farthest-side_at_top,white,transparent)] opacity-100">
          <GridPattern
            width={20}
            height={20}
            x="-12"
            y="4"
            squares={p}
            className="absolute inset-0 h-full w-full fill-green-500/5 stroke-green-500/20 mix-blend-overlay"
          />
        </div>
      </div>
      <feature.icon
        className="size-6 text-green-500"
        strokeWidth={1.5}
        aria-hidden
      />
      <h3 className="mt-10 text-sm font-medium md:text-xl">{feature.title}</h3>
      <p className="text-muted-foreground relative z-20 mt-2 text-sm font-light">
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
    <section className="w-full py-16 md:py-32">
      <div className="mx-auto w-full space-y-8 px-4">
        <AnimatedContainer className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-wide text-balance md:text-4xl lg:text-5xl xl:font-extrabold">
            Secure. Simple. Seamless.
          </h2>
          <p className="text-muted-foreground mt-4 text-sm tracking-wide text-balance md:text-base">
            Everything you need to easily and efficiently integrate privacy into
            your application.
          </p>
        </AnimatedContainer>

        <AnimatedContainer
          delay={0.4}
          className="grid w-full grid-cols-1 divide-x divide-y divide-dashed border border-dashed sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
        >
          {benefits.map((benefit, i) => (
            <FeatureCard key={i} feature={benefit} />
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
