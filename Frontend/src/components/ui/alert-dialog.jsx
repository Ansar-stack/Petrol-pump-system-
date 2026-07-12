/**
 * AlertDialog – pure JSX confirmation dialog, no Radix UI
 * Usage:
 *   <AlertDialog open={open} onOpenChange={setOpen}>
 *     <AlertDialogContent>
 *       <AlertDialogHeader>
 *         <AlertDialogTitle>Are you sure?</AlertDialogTitle>
 *         <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
 *       </AlertDialogHeader>
 *       <AlertDialogFooter>
 *         <AlertDialogCancel>Cancel</AlertDialogCancel>
 *         <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
 *       </AlertDialogFooter>
 *     </AlertDialogContent>
 *   </AlertDialog>
 */
import { createPortal } from "react-dom";
import { Button } from "./button.jsx";

export function AlertDialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      {children}
    </div>,
    document.body,
  );
}

export function AlertDialogContent({ className = "", children, ...props }) {
  return (
    <div
      className={[
        "relative z-50 w-full max-w-[calc(100%-2rem)] md:max-w-md",
        "rounded-xl border border-border bg-background p-6 shadow-xl",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogHeader({ className = "", children, ...props }) {
  return (
    <div
      className={["mb-4 flex flex-col gap-2", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogTitle({ className = "", children, ...props }) {
  return (
    <h2
      className={["text-lg font-semibold text-foreground", className].join(" ")}
      {...props}
    >
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ className = "", children, ...props }) {
  return (
    <p
      className={["text-sm text-muted-foreground", className].join(" ")}
      {...props}
    >
      {children}
    </p>
  );
}

export function AlertDialogFooter({ className = "", children, ...props }) {
  return (
    <div
      className={["mt-4 flex justify-end gap-2", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogCancel({
  className = "",
  children,
  onClick,
  ...props
}) {
  return (
    <Button
      variant="outline"
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AlertDialogAction({
  className = "",
  children,
  onClick,
  ...props
}) {
  return (
    <Button
      variant="destructive"
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  );
}
