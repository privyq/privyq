import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-transform duration-200 ease-ease active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      variant: {
        ink: "bg-ink text-white shadow-ink hover:-translate-y-0.5",
        white: "bg-white text-ink border border-line hover:-translate-y-0.5 shadow-sm",
        outline: "border-[1.5px] border-line bg-white text-ink hover:border-ink",
        ghost: "text-ink-2 hover:bg-tint",
        danger: "bg-red text-white hover:-translate-y-0.5",
        mint: "bg-mint text-ink hover:-translate-y-0.5",
      },
      size: {
        sm: "px-4 py-2 text-sm",
        md: "px-5 py-2.5 text-[.95rem]",
        lg: "px-7 py-3.5 text-base",
      },
    },
    defaultVariants: { variant: "ink", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
