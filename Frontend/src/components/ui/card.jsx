/**
 * Card – pure JSX UI components
 */

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={[
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div
      className={["flex flex-col space-y-1.5 p-6", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3
      className={[
        "text-lg font-semibold leading-none tracking-tight text-balance",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p
      className={["text-sm text-muted-foreground text-pretty", className].join(
        " ",
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={["p-6 pt-0", className].join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div
      className={["flex items-center p-6 pt-0", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
