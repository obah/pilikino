"use client";

import { motion } from "framer-motion";
import { ArrowRight, Copy, Check } from "lucide-react";
import { useState } from "react";
import { AuroraBackground } from "./ui/aurora-background";
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
    <AuroraBackground>
      <motion.section
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-20"
      >
        <div className="z-10 container flex flex-col items-center gap-8 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h1 className="neon-text text-primary bg-clip-text text-[50px] font-bold tracking-widest md:text-[80px]">
              PILIKINO
            </h1>
            <div className="mx-auto max-w-4xl text-xl font-semibold text-white md:text-5xl">
              <p className="inline opacity-90">
                The best way to add privacy to your{" "}
              </p>
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
    </AuroraBackground>
  );
};
