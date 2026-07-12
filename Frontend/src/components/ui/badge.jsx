/**
 * Badge – pure JSX, no Radix UI
 */

const variantClasses = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  outline: "border border-border text-foreground bg-transparent",
};

export function Badge({
  className = "",
  variant = "default",
  children,
  ...props
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        "transition-colors",
        variantClasses[variant] ?? variantClasses.default,
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
