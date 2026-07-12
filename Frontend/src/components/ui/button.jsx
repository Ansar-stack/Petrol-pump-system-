/**
 * Button – pure JSX, no TypeScript, no Radix UI
 * Variants: default | secondary | outline | ghost | destructive | link
 * Sizes:    default | sm | lg | icon
 */
import { forwardRef } from "react";

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-80",
  outline: "border border-border bg-background text-foreground hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  link: "underline-offset-4 hover:underline text-primary bg-transparent",
};

const sizeClasses = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-8 text-base",
  icon: "h-9 w-9 p-0",
};

const Button = forwardRef(function Button(
  {
    className = "",
    variant = "default",
    size = "default",
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        "whitespace-nowrap cursor-pointer",
        variantClasses[variant] ?? variantClasses.default,
        sizeClasses[size] ?? sizeClasses.default,
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
});

export { Button };
