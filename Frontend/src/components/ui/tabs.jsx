/**
 * Tabs – pure JSX, no Radix UI
 * Usage:
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="a">Tab A</TabsTrigger>
 *       <TabsTrigger value="b">Tab B</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="a">Content A</TabsContent>
 *     <TabsContent value="b">Content B</TabsContent>
 *   </Tabs>
 */
import { createContext, useContext, useState } from "react";

const TabsCtx = createContext(null);

export function Tabs({
  value,
  onValueChange,
  defaultValue,
  className = "",
  children,
  ...props
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : internal;
  const setCurrent = onValueChange ?? setInternal;
  return (
    <TabsCtx.Provider value={{ current, setCurrent }}>
      <div className={["flex flex-col gap-2", className].join(" ")} {...props}>
        {children}
      </div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ className = "", children, ...props }) {
  return (
    <div
      className={[
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      ].join(" ")}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className = "", children, ...props }) {
  const { current, setCurrent } = useContext(TabsCtx);
  const active = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => setCurrent(value)}
      className={[
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium",
        "transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        active
          ? "bg-background text-foreground shadow"
          : "hover:bg-background/50 hover:text-foreground",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = "", children, ...props }) {
  const { current } = useContext(TabsCtx);
  if (current !== value) return null;
  return (
    <div
      role="tabpanel"
      className={["mt-2 focus-visible:outline-none", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
