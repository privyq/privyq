import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-mono text-[.68rem] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        neutral: "border-line bg-white text-muted",
        ink: "border-ink bg-ink text-white",
        granted: "border-mint/40 bg-mint/10 text-[#0a9c6b]",
        denied: "border-red/40 bg-red/10 text-[#c62d50]",
        blue: "border-blue/30 bg-blue/10 text-blue",
        amber: "border-amber/40 bg-amber/15 text-[#a76a00]",
        muted: "border-line bg-tint text-muted",
      },
      size: {
        sm: "px-2 py-0.5",
        md: "px-2.5 py-1",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
