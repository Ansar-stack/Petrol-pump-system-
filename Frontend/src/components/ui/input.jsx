/**
 * Input – pure JSX, no TypeScript, no Radix UI
 */
import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { className = "", type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={[
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm",
        "shadow-sm transition-colors placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
      {...props}
    />
  );
});

export { Input };
