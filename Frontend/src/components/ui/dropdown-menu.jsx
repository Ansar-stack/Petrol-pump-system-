/**
 * DropdownMenu – pure JSX, no Radix UI
 * Usage:
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild>
 *       <Button>Open</Button>
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuItem onClick={fn}>Item</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const DropdownCtx = createContext(null);

export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  return (
    <DropdownCtx.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownCtx.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild = false }) {
  const { open, setOpen, triggerRef } = useContext(DropdownCtx);
  const toggle = () => setOpen((o) => !o);

  if (asChild) {
    return cloneElement(children, {
      ref: triggerRef,
      onClick: (e) => {
        children.props.onClick?.(e);
        toggle();
      },
    });
  }
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={toggle}
      className="cursor-pointer"
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className = "",
  align = "start",
  ...props
}) {
  const { open, setOpen, triggerRef } = useContext(DropdownCtx);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left:
          align === "end"
            ? rect.right +
              window.scrollX -
              (menuRef.current?.offsetWidth ?? 160)
            : rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left, minWidth: pos.width || 160 }}
      className={[
        "fixed z-[9999] overflow-hidden rounded-md border border-border",
        "bg-popover text-popover-foreground shadow-md",
        className,
      ].join(" ")}
      {...props}
    >
      <div className="p-1">{children}</div>
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  children,
  className = "",
  onClick,
  disabled = false,
  ...props
}) {
  const { setOpen } = useContext(DropdownCtx);
  return (
    <div
      role="menuitem"
      onClick={() => {
        if (!disabled) {
          onClick?.();
          setOpen(false);
        }
      }}
      className={[
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
        "outline-none transition-colors",
        disabled
          ? "pointer-events-none opacity-50"
          : "hover:bg-accent hover:text-accent-foreground",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = "" }) {
  return <div className={["-mx-1 my-1 h-px bg-border", className].join(" ")} />;
}

export function DropdownMenuLabel({ children, className = "", ...props }) {
  return (
    <div
      className={[
        "px-2 py-1.5 text-xs font-semibold text-muted-foreground",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
