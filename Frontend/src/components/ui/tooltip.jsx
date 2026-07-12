/**
 * Tooltip – pure JSX, no Radix UI
 * TooltipProvider is a no-op wrapper kept for API compatibility.
 */
import { useState } from "react";

export function TooltipProvider({ children }) {
  return <>{children}</>;
}

export function Tooltip({ children }) {
  return <div className="relative inline-block">{children}</div>;
}

export function TooltipTrigger({ children, asChild = false }) {
  return <>{children}</>;
}

export function TooltipContent({
  children,
  className = "",
  side = "top",
  ...props
}) {
  return (
    <div
      className={[
        "absolute z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5",
        "text-xs text-background shadow-md",
        side === "top" ? "bottom-full mb-1 left-1/2 -translate-x-1/2" : "",
        side === "bottom" ? "top-full mt-1 left-1/2 -translate-x-1/2" : "",
        side === "left" ? "right-full mr-1 top-1/2 -translate-y-1/2" : "",
        side === "right" ? "left-full ml-1 top-1/2 -translate-y-1/2" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
