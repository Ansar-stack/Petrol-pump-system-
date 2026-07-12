/**
 * Select – pure JSX custom dropdown, no Radix UI
 * Mirrors the shadcn/ui API:
 *   <Select value={val} onValueChange={setVal}>
 *     <SelectTrigger><SelectValue placeholder="Pick..." /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">Option A</SelectItem>
 *     </SelectContent>
 *   </Select>
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SelectCtx = createContext(null);

export function Select({ value, onValueChange, children, disabled = false }) {
  const [open, setOpen] = useState(false);
  return (
    <SelectCtx.Provider
      value={{ value, onValueChange, open, setOpen, disabled }}
    >
      <div className="relative">{children}</div>
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ className = "", children, ...props }) {
  const { open, setOpen, disabled } = useContext(SelectCtx);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      className={[
        "flex h-9 w-full items-center justify-between rounded-md border border-input",
        "bg-background px-3 py-2 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
      <svg
        className="h-4 w-4 shrink-0 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder = "" }) {
  const { value } = useContext(SelectCtx);
  return (
    <span className={value ? "text-foreground" : "text-muted-foreground"}>
      {value || placeholder}
    </span>
  );
}

export function SelectContent({ className = "", children, ...props }) {
  const { open, setOpen } = useContext(SelectCtx);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className={[
        "fixed z-[9999] min-w-[8rem] overflow-hidden rounded-md border border-border",
        "bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        className,
      ].join(" ")}
      style={(() => {
        // Position relative to trigger – fallback to center if no active element
        const trigger = document.activeElement?.closest("button");
        if (trigger) {
          const rect = trigger.getBoundingClientRect();
          return {
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            minWidth: rect.width,
          };
        }
        return { top: "50%", left: "50%" };
      })()}
      {...props}
    >
      <div className="p-1">{children}</div>
    </div>,
    document.body,
  );
}

export function SelectItem({ value, className = "", children, ...props }) {
  const ctx = useContext(SelectCtx);
  const isSelected = ctx.value === value;
  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        ctx.onValueChange?.(value);
        ctx.setOpen(false);
      }}
      className={[
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm",
        "outline-none hover:bg-accent hover:text-accent-foreground",
        isSelected ? "bg-accent font-medium text-accent-foreground" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
      {isSelected && (
        <svg
          className="ms-auto h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  );
}

export function SelectSeparator({ className = "" }) {
  return <div className={["-mx-1 my-1 h-px bg-border", className].join(" ")} />;
}
