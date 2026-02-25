import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:bg-primary/30 hover:border-primary hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02] active:scale-95 transition-all font-bold tracking-widest uppercase",
        destructive:
          "bg-destructive/20 text-destructive border border-destructive/50 hover:bg-destructive/30 hover:border-destructive hover:shadow-[0_0_20px_rgba(255,0,0,0.3)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 hover:scale-[1.02] active:scale-95 transition-all font-bold tracking-widest uppercase",
        outline:
          "border border-primary/30 bg-transparent text-primary hover:bg-primary/10 hover:border-primary/80 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:scale-[1.02] active:scale-95 transition-all font-bold tracking-widest uppercase",
        secondary:
          "bg-secondary/40 text-secondary-foreground border border-secondary/50 hover:bg-secondary/60 hover:scale-[1.02] active:scale-95 transition-all font-bold tracking-widest uppercase",
        ghost:
          "text-primary/80 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_10px_rgba(34,197,94,0.1)] hover:scale-[1.02] active:scale-95 transition-all font-bold tracking-widest uppercase",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 font-bold tracking-widest uppercase",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-sm gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-sm px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
