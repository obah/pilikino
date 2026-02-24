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
            <h1 className="bg-clip-text text-[40px] font-bold tracking-tight text-green-500">
              Pilikino
            </h1>
            <div className="mx-auto max-w-4xl text-xl font-semibold text-white md:text-6xl">
              <p className="inline">The best way to add privacy to your </p>
              <AnimatedText
                texts={rotatingTexts}
                colors={colors}
                className="ml-3"
                duration={1500}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group relative cursor-pointer overflow-hidden rounded-full border border-green-500/20 backdrop-blur-3xl"
            onClick={handleCopy}
          >
            <div className="relative z-10 flex items-center gap-4 px-8 py-5">
              <p className="font-mono text-lg text-white">{command}</p>
              <div className="text-muted-foreground">
                {copied ? (
                  <Check size={18} className="text-green-500" />
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
              className="group bg-foreground text-background relative flex items-center gap-2 rounded-sm px-8 py-3 text-lg font-semibold transition-all hover:cursor-pointer hover:opacity-90"
            >
              Get Started
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </AuroraBackground>
  );
};
