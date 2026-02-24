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

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, duration);
    return () => clearInterval(interval);
  }, [texts.length, duration]);

  const currentColor = colors ? colors[index % colors.length] : "";

  return (
    <div className=" inline-block w-fit overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={texts[index]}
          initial={{ y: 20, opacity: 0, filter: "blur(5px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -20, opacity: 0, filter: "blur(5px)" }}
          transition={{
            y: { type: "spring", stiffness: 100, damping: 15 },
            opacity: { duration: 0.3 },
            filter: { duration: 0.3 },
          }}
          className={cn(className, currentColor)}
        >
          {texts[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
