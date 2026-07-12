/**
 * Textarea – pure JSX, no TypeScript, no Radix UI
 */
import { forwardRef } from "react";

const Textarea = forwardRef(function Textarea(
  { className = "", ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={[
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "shadow-sm placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        className,
      ].join(" ")}
      {...props}
    />
  );
});

export { Textarea };
