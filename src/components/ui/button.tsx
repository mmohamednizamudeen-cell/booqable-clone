import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-[var(--motion-fast)] disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        secondary: "border border-line-input bg-surface text-ink hover:bg-surface-muted",
        ghost: "text-ink hover:bg-accent-subtle",
        danger: "bg-danger text-on-accent hover:opacity-90",
        link: "h-auto px-0 text-link underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        "icon-sm": "size-8",
        icon: "size-10",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
