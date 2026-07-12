/**
 * Progress – pure JSX, no Radix UI
 */

export function Progress({ value = 0, className = "", ...props }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={[
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      ].join(" ")}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-in-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
