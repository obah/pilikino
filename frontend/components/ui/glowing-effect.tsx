"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { animate } from "framer-motion";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "white" | "blue";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
  alwaysOn?: boolean;
}
const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = "default",
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
    alwaysOn = false,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>(0);

    const handleMove = useCallback(
      (e?: MouseEvent | { x: number; y: number }) => {
        if (!containerRef.current) return;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;

          if (e) {
            lastPosition.current = { x: mouseX, y: mouseY };
          }

          if (alwaysOn) {
            element.style.setProperty("--active", "1");
            // For always on, we can optionally just animate it automatically or let it follow mouse
            // If we want it to just 'move', we might need a continuous animation loop not dependent on mouse
            // But for now, let's keep the mouse interaction logic or default center if mouse is far?
            // Actually, if alwaysOn is true, let's just make sure it stays visible.
            // If we want continuous animation without mouse, we'd need a different effect (like the BorderBeam).
            // However, the request is to use THIS effect.
            // Let's assume 'alwaysOn' just means opacity is 1, but movement still follows mouse or defaults.
          } else {
            const center = [left + width * 0.5, top + height * 0.5];
            const distanceFromCenter = Math.hypot(
              mouseX - center[0],
              mouseY - center[1],
            );
            const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

            if (distanceFromCenter < inactiveRadius) {
              element.style.setProperty("--active", "0");
              return;
            }

            const isActive =
              mouseX > left - proximity &&
              mouseX < left + width + proximity &&
              mouseY > top - proximity &&
              mouseY < top + height + proximity;

            element.style.setProperty("--active", isActive ? "1" : "0");
            if (!isActive) return;
          }

          // Angle calculation
          const center = [left + width * 0.5, top + height * 0.5];
          const currentAngle =
            parseFloat(element.style.getPropertyValue("--start")) || 0;

          let targetAngle = currentAngle;

          if (alwaysOn) {
            // If always on and no mouse event (e.g. init), maybe auto rotate?
            // Or just use mouse position even if far away.
            // Let's rely on the global mouse listener.
            // But if we want it to 'move' continuously like a loading spinner when idle, that's different.
            // The user said "replace animation... with animation of the cards".
            // The cards follow the mouse.
            // But "borders show everytime not when hovered on".
            // So we just bypass the active check.
            targetAngle =
              (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) /
                Math.PI +
              90;
          } else {
            targetAngle =
              (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) /
                Math.PI +
              90;
          }

          const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
          const newAngle = currentAngle + angleDiff;

          animate(currentAngle, newAngle, {
            duration: movementDuration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (value) => {
              element.style.setProperty("--start", String(value));
            },
          });
        });
      },
      [inactiveZone, proximity, movementDuration, alwaysOn],
    );

    useEffect(() => {
      if (disabled) return;

      const handleScroll = () => handleMove();
      const handlePointerMove = (e: PointerEvent) => handleMove(e);

      window.addEventListener("scroll", handleScroll, { passive: true });
      document.body.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });

      // Trigger initial move to set state
      handleMove();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("scroll", handleScroll);
        document.body.removeEventListener("pointermove", handlePointerMove);
      };
    }, [handleMove, disabled]);

    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity",
            glow && "opacity-100",
            variant === "white" && "border-white",
            disabled && "!block",
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--spread": spread,
              "--start": "0",
              "--active": alwaysOn ? "1" : "0",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--gradient":
                variant === "white"
                  ? `repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  var(--black),
                  var(--black) calc(25% / var(--repeating-conic-gradient-times))
                )`
                  : variant === "blue"
                  ? `radial-gradient(circle, #22d3ee 10%, #22d3ee00 20%),
                radial-gradient(circle at 40% 40%, #06b6d4 5%, #06b6d400 15%),
                radial-gradient(circle at 60% 60%, #0891b2 10%, #0891b200 20%), 
                radial-gradient(circle at 40% 60%, #67e8f9 10%, #67e8f900 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #22d3ee 0%,
                  #06b6d4 calc(25% / var(--repeating-conic-gradient-times)),
                  #0891b2 calc(50% / var(--repeating-conic-gradient-times)), 
                  #67e8f9 calc(75% / var(--repeating-conic-gradient-times)),
                  #22d3ee calc(100% / var(--repeating-conic-gradient-times))
                )`
                  : `radial-gradient(circle, #3df29a 10%, #3df29a00 20%),
                radial-gradient(circle at 40% 40%, #10b981 5%, #10b98100 15%),
                radial-gradient(circle at 60% 60%, #059669 10%, #05966900 20%), 
                radial-gradient(circle at 40% 60%, #34d399 10%, #34d39900 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #3df29a 0%,
                  #10b981 calc(25% / var(--repeating-conic-gradient-times)),
                  #059669 calc(50% / var(--repeating-conic-gradient-times)), 
                  #34d399 calc(75% / var(--repeating-conic-gradient-times)),
                  #3df29a calc(100% / var(--repeating-conic-gradient-times))
                )`,
            } as React.CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            glow && "opacity-100",
            blur > 0 && "blur-(--blur) ",
            className,
            disabled && "!hidden",
          )}
        >
          <div
            className={cn(
              "glow",
              "rounded-[inherit]",
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:bg-fixed",
              "after:opacity-(--active) after:transition-opacity after:duration-300",
              "after:[mask-clip:padding-box,border-box]",
              "after:mask-intersect",
              "after:mask-[linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
            )}
          />
        </div>
      </>
    );
  },
);

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };
