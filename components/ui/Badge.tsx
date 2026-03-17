import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "sage" | "dark" | "gold";
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  sage: "bg-sage/10 text-sage border border-sage/15",
  dark: "bg-dark/8 text-dark border border-dark/10",
  gold: "bg-accent/10 text-dark border border-accent/25",
};

export function Badge({ children, variant = "sage", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
