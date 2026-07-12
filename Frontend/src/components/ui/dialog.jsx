/**
 * Dialog / Modal – pure JSX, no Radix UI
 * Usage:
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogContent>
 *       <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
 *       ...content...
 *     </DialogContent>
 *   </Dialog>
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Dialog({ open, onOpenChange, children }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </div>,
    document.body,
  );
}

export function DialogContent({ className = "", children, ...props }) {
  return (
    <div
      className={[
        "relative z-50 w-full max-w-[calc(100%-2rem)] md:max-w-lg",
        "rounded-xl border border-border bg-background shadow-xl",
        "max-h-[90dvh] overflow-y-auto",
        className,
      ].join(" ")}
      {...props}
    >
      <div className="p-6">{children}</div>
    </div>
  );
}

export function DialogHeader({ className = "", children, ...props }) {
  return (
    <div
      className={["mb-4 flex flex-col gap-1.5", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ className = "", children, ...props }) {
  return (
    <h2
      className={["text-lg font-semibold text-foreground", className].join(" ")}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({ className = "", children, ...props }) {
  return (
    <p
      className={["text-sm text-muted-foreground", className].join(" ")}
      {...props}
    >
      {children}
    </p>
  );
}

export function DialogFooter({ className = "", children, ...props }) {
  return (
    <div
      className={["mt-4 flex justify-end gap-2", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
