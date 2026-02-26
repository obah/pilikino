"use client";

import { motion } from "framer-motion";
import { ArrowRight, Copy, Check } from "lucide-react";
import { useState } from "react";
import { AnimatedText } from "./ui/animated-text";
import Link from "next/link";

export const HeroSection = () => {
  const [copied, setCopied] = useState(false);
  const command = "npm i pilikino";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rotatingTexts = [
    "dApp",
    "DeFi",
    "DAO",
    "Prediction Market",
    "Perps",
    "Web3 infra",
    "AI agents",
    "next project",
  ];

  const colors = [
    "text-green-500",
    "text-emerald-500",
    "text-teal-500",
    "text-cyan-500",
    "text-blue-500",
    "text-lime-300",
    "text-lime-500",
    "text-green-400",
  ];

  return (
    <motion.section
      initial={{ opacity: 0.0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.3,
        duration: 0.8,
        ease: "easeInOut",
      }}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black pt-20"
    >
      <div className="[mask-[radial-gradient(circle_at_center,white,transparent_90%)] pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.16)_1px,transparent_1px)] bg-size-[56px_56px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.08)_1px,transparent_1px)] bg-size-[14px_14px]" />
      </div>
      <div className="pointer-events-none absolute inset-0">
        {[
          { top: "8%", left: "15%", delay: 0.1, duration: 1.8 },
          { top: "18%", left: "68%", delay: 0.45, duration: 1.4 },
          { top: "32%", left: "40%", delay: 0.2, duration: 2.1 },
          { top: "46%", left: "74%", delay: 0.7, duration: 1.7 },
          { top: "58%", left: "20%", delay: 0.35, duration: 1.5 },
          { top: "70%", left: "53%", delay: 0.55, duration: 1.9 },
          { top: "82%", left: "32%", delay: 0.15, duration: 1.6 },
          { top: "84%", left: "80%", delay: 0.5, duration: 1.3 },
        ].map((square, idx) => (
          <motion.span
            key={`flicker-square-${idx}`}
            className="absolute h-3 w-3 rounded-[2px] border border-emerald-400/70 bg-emerald-400/20 shadow-[0_0_10px_rgba(16,185,129,0.55)]"
            style={{ top: square.top, left: square.left }}
            initial={{ opacity: 0.1, scale: 1 }}
            animate={{
              opacity: [0.06, 0.65, 0.15, 0.85, 0.1],
              scale: [1, 1.12, 0.98, 1.08, 1],
            }}
            transition={{
              duration: square.duration,
              delay: square.delay,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_55%)]" />

      <div className="z-10 container flex flex-col items-center gap-8 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <h1 className="text-primary text-[50px] font-bold tracking-widest [text-shadow:0_0_8px_rgba(34,197,94,0.75),0_0_24px_rgba(16,185,129,0.65),0_0_44px_rgba(20,184,166,0.4)] md:text-[80px]">
            PILIKINO
          </h1>
          <div className="mx-auto max-w-3xl space-y-6 text-xl font-semibold text-white md:text-5xl">
            <p className="opacity-90">The best way to add privacy to your </p>
            <AnimatedText
              texts={rotatingTexts}
              colors={colors}
              className="ml-3 font-mono tracking-wide"
              duration={1500}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="group border-primary/30 hover:border-primary/60 relative cursor-pointer overflow-hidden rounded-md border bg-black/60 shadow-[0_0_15px_rgba(34,197,94,0.15)] backdrop-blur-3xl transition-all hover:shadow-[0_0_25px_rgba(34,197,94,0.3)]"
          onClick={handleCopy}
        >
          <div className="relative z-10 flex items-center gap-4 px-8 py-5">
            <p className="text-primary font-mono text-lg tracking-wider">
              {command}
            </p>
            <div className="text-primary/70 group-hover:text-primary transition-colors">
              {copied ? (
                <Check size={18} className="text-primary" />
              ) : (
                <Copy size={18} />
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link
            href="/docs"
            target="_blank"
            className="group border-primary bg-primary/10 text-primary hover:bg-primary/20 relative flex items-center gap-2 overflow-hidden rounded-sm border px-8 py-3 text-lg font-bold tracking-widest transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
          >
            <span className="relative z-10 uppercase">Get Started</span>
            <ArrowRight
              size={18}
              className="relative z-10 transition-transform group-hover:translate-x-1"
            />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
};
