import { clsx } from "clsx";

const statusMap = {
  active: "status-active",
  inactive: "status-inactive",
  suspended: "status-suspended",
  blocked: "status-blocked",
  pending: "status-pending",
  confirmed: "status-confirmed",
  rejected: "status-rejected",
  paid: "status-paid",
  partial: "status-partial",
  unpaid: "status-unpaid",
  maintenance:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function StatusBadge({ status, className }) {
  const cls = statusMap[status.toLowerCase()] ?? "status-inactive";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        cls,
        className,
      )}
    >
      {status}
    </span>
  );
}
