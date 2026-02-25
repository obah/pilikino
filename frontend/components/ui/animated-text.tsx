"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface AnimatedTextProps {
  texts: string[];
  colors?: string[];
  className?: string;
  duration?: number;
}

export const AnimatedText = ({
  texts,
  colors,
  className,
  duration = 2000,
}: AnimatedTextProps) => {
  const [index, setIndex] = useState(0);
  const [glitchTick, setGlitchTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
      setGlitchTick((prev) => prev + 1);
    }, duration);
    return () => clearInterval(interval);
  }, [texts.length, duration]);

  const currentColor = colors ? colors[index % colors.length] : "";

  return (
    <div className="relative inline-flex w-fit overflow-hidden align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={texts[index]}
          initial={{
            y: 18,
            opacity: 0,
            filter: "blur(4px)",
            clipPath: "inset(0 0 100% 0)",
          }}
          animate={{
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            clipPath: "inset(0 0 0% 0)",
          }}
          exit={{
            y: -14,
            opacity: 0,
            filter: "blur(3px)",
            clipPath: "inset(100% 0 0 0)",
          }}
          transition={{
            y: { type: "spring", stiffness: 150, damping: 18 },
            opacity: { duration: 0.24 },
            filter: { duration: 0.24 },
            clipPath: { duration: 0.24 },
          }}
          className={cn(
            "relative inline-block [text-shadow:0_0_10px_rgba(16,185,129,0.5),0_0_22px_rgba(20,184,166,0.35)]",
            className,
            currentColor
          )}
        >
          {texts[index]}

          <motion.span
            aria-hidden
            key={`${texts[index]}-glitch-a-${glitchTick}`}
            className="pointer-events-none absolute inset-0 text-emerald-300/70"
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: [0, 0.45, 0], x: [0, 2, -1, 0] }}
            transition={{
              duration: 0.3,
              times: [0, 0.5, 1],
              ease: "easeInOut",
              delay: 0.05,
            }}
          >
            {texts[index]}
          </motion.span>
          <motion.span
            aria-hidden
            key={`${texts[index]}-glitch-b-${glitchTick}`}
            className="pointer-events-none absolute inset-0 text-cyan-300/60"
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: [0, 0.35, 0], x: [0, -2, 1, 0] }}
            transition={{
              duration: 0.28,
              times: [0, 0.45, 1],
              ease: "easeInOut",
              delay: 0.09,
            }}
          >
            {texts[index]}
          </motion.span>
        </motion.span>
      </AnimatePresence>

      <motion.span
        aria-hidden
        key={`scanline-${texts[index]}-${glitchTick}`}
        className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent mix-blend-screen"
        initial={{ y: "-25%", opacity: 0 }}
        animate={{ y: ["0%", "125%"], opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.42, ease: "easeInOut", delay: 0.04 }}
      />
    </div>
  );
};
