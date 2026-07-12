import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FiPrinter, FiDownload, FiFileText, FiShoppingCart, FiTrendingUp,
  FiTrendingDown, FiDollarSign, FiDroplet, FiAlertTriangle,
  FiUsers, FiCalendar, FiBarChart2,
} from "react-icons/fi";
import { format, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useReactToPrint } from "react-to-print";
import {
  salesApi,
  purchasesApi,
  expensesApi,
  lossesApi,
  tanksApi,
  fuelTypesApi,
  customersApi,
} from "@/services/api";
import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n, fmtCurrency } from "@/components/context/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Safely extract date-only portion (handles ISO timestamps and plain YYYY-MM-DD)
function toDateStr(d) {
  return d ? String(d).substring(0, 10) : "";
}
function inRange(d, start, end) {
  const ds = toDateStr(d);
  return ds >= start && ds <= end;
}

// ── Report type metadata ───────────────────────────────────────────────────────
const REPORT_META = {
  daily_sales:     { icon: FiCalendar,      color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  weekly_sales:    { icon: FiBarChart2,     color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  monthly_sales:   { icon: FiShoppingCart,  color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" },
  fuel_stock:      { icon: FiDroplet,       color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-900/20" },
  profit:          { icon: FiTrendingUp,    color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20" },
  loss:            { icon: FiTrendingDown,  color: "text-destructive",                    bg: "bg-destructive/5" },
  expense:         { icon: FiDollarSign,    color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  credit:          { icon: FiUsers,         color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  daily_summary:   { icon: FiFileText,      color: "text-primary",                        bg: "bg-primary/5" },
  monthly_summary: { icon: FiBarChart2,     color: "text-primary",                        bg: "bg-primary/5" },
};

// ── KPI card colour based on label semantics ──────────────────────────────────
function kpiColor(label, value) {
  const lower = label.toLowerCase();
  if (lower.includes("profit") || lower.includes("revenue")) {
    const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return n >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive";
  }
  if (lower.includes("cost") || lower.includes("expense") || lower.includes("loss"))
    return "text-destructive";
  return "text-foreground";
}

export default function ReportsPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { t, lang } = useI18n();

  const defaultRanges = {
    daily_sales: { from: today, to: today },
    weekly_sales: {
      from: format(startOfWeek(new Date(), { weekStartsOn: 6 }), "yyyy-MM-dd"),
      to: today,
    },
    monthly_sales: {
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    },
    fuel_stock: {
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: today,
    },
    profit: { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: today },
    loss: { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: today },
    expense: {
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: today,
    },
    credit: { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: today },
    daily_summary: { from: today, to: today },
    monthly_summary: {
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    },
  };

  const [reportType, setReportType] = useState("daily_sales");
  const [dateFrom, setDateFrom] = useState(defaultRanges.daily_sales.from);
  const [dateTo, setDateTo] = useState(defaultRanges.daily_sales.to);
  const printRef = useRef(null);

  const handleReportTypeChange = (v) => {
    setReportType(v);
    const r = defaultRanges[v];
    if (r) {
      setDateFrom(r.from);
      setDateTo(r.to);
    }
  };

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: salesApi.getAll,
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: purchasesApi.getAll,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: expensesApi.getAll,
  });
  const { data: losses = [] } = useQuery({
    queryKey: ["losses"],
    queryFn: lossesApi.getAll,
  });
  const { data: tanks = [] } = useQuery({
    queryKey: ["tanks"],
    queryFn: tanksApi.getAll,
  });
  const { data: fuelTypes = [] } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.getAll,
  });

  const periodLabel = {
    daily_sales: t("dailySales"),
    weekly_sales: t("weeklySales"),
    monthly_sales: t("monthlySales"),
    fuel_stock: t("fuelStockReport"),
    profit: t("profitReport"),
    loss: t("lossReport"),
    expense: t("expenseReport"),
    credit: t("creditReport"),
    daily_summary: t("dailySummary"),
    monthly_summary: t("monthlySummary"),
  };

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const handlePDF = () => {
    const rd = getReportData();
    if (!rd) return;
    const { columns, rows, summary } = rd;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(periodLabel[reportType] ?? reportType, 14, 20);
    doc.setFontSize(10);
    doc.text(`${t("period")}: ${dateFrom} ${t("to")} ${dateTo}`, 14, 30);
    doc.text(
      `${t("generated")}: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
      14,
      37,
    );
    let startY = 48;
    if (summary.length > 0) {
      doc.setFontSize(11);
      doc.text(t("metric"), 14, 50);
      summary.forEach((s, i) => {
        doc.setFontSize(9);
        doc.text(`${s.label}: ${s.value}`, 14, 58 + i * 7);
      });
      startY = 58 + summary.length * 7 + 8;
    }
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY,
      styles: { fontSize: 8 },
    });
    doc.save(`${reportType}-${dateFrom}.pdf`);
  };

  const filteredSales = sales.filter((s) => inRange(s.date, dateFrom, dateTo));
  const filteredPurchases = purchases.filter((p) =>
    inRange(p.date, dateFrom, dateTo),
  );
  const filteredExpenses = expenses.filter((e) =>
    inRange(e.date, dateFrom, dateTo),
  );
  const filteredLosses = losses.filter((l) =>
    inRange(l.date, dateFrom, dateTo),
  );

  function getReportData() {
    switch (reportType) {
      case "daily_sales":
      case "weekly_sales":
      case "monthly_sales": {
        const totalRev = filteredSales.reduce(
          (a, s) => a + (s.totalAmount ?? 0),
          0,
        );
        const totalL = filteredSales.reduce((a, s) => a + (s.liters ?? 0), 0);
        return {
          columns: [
            t("transactionId"),
            t("customer"),
            t("fuel"),
            t("liters"),
            t("pricePerLiter"),
            t("total"),
            t("method"),
            t("date"),
          ],
          rows: filteredSales.map((s) => [
            s.transactionId ?? "",
            s.customerName ?? "-",
            fuelTypes.find((f) => f.id === s.fuelTypeId)?.name ?? "-",
            `${s.liters ?? 0}L`,
            fmtCurrency(s.pricePerLiter ?? 0, lang, 3),
            fmtCurrency(s.totalAmount ?? 0, lang),
            s.paymentMethod ?? "",
            toDateStr(s.date),
          ]),
          summary: [
            {
              label: t("totalTransactions"),
              value: String(filteredSales.length),
            },
            { label: t("totalRevenue"), value: fmtCurrency(totalRev, lang) },
            { label: t("totalLitersSold"), value: `${totalL}L` },
          ],
        };
      }
      case "fuel_stock":
        return {
          columns: [
            t("name"),
            t("fuel"),
            t("capacityL"),
            t("currentStockL"),
            t("minLevelL"),
            t("usage"),
            t("status"),
          ],
          rows: tanks.map((tank) => {
            const ft = fuelTypes.find((f) => f.id === tank.fuelTypeId);
            const pct =
              tank.capacity > 0
                ? Math.round((tank.currentStock / tank.capacity) * 100)
                : 0;
            return [
              tank.name ?? "",
              ft?.name ?? "-",
              `${tank.capacity ?? 0}L`,
              `${tank.currentStock ?? 0}L`,
              `${tank.minimumLevel ?? 0}L`,
              `${pct}%`,
              t(tank.status) || tank.status,
            ];
          }),
          summary: [
            { label: t("totalTanks"), value: String(tanks.length) },
            {
              label: t("totalStock"),
              value: `${tanks.reduce((a, tk) => a + (tk.currentStock ?? 0), 0).toLocaleString()}L`,
            },
          ],
        };
      case "profit": {
        const rev = filteredSales.reduce((a, s) => a + (s.totalAmount ?? 0), 0);
        const cost = filteredPurchases.reduce(
          (a, p) => a + (p.totalAmount ?? 0),
          0,
        );
        const exp = filteredExpenses.reduce((a, e) => a + (e.amount ?? 0), 0);
        const net = rev - cost - exp;
        return {
          columns: [
            t("period"),
            t("revenue"),
            t("fuelCost"),
            t("expenses"),
            t("netProfit"),
          ],
          rows: [
            [
              `${dateFrom} → ${dateTo}`,
              fmtCurrency(rev, lang),
              fmtCurrency(cost, lang),
              fmtCurrency(exp, lang),
              fmtCurrency(net, lang),
            ],
          ],
          summary: [
            { label: t("revenue"), value: fmtCurrency(rev, lang) },
            { label: t("fuelCost"), value: fmtCurrency(cost, lang) },
            { label: t("expenses"), value: fmtCurrency(exp, lang) },
            { label: t("netProfit"), value: fmtCurrency(net, lang) },
          ],
        };
      }
      case "loss":
        return {
          columns: [
            t("lossId"),
            t("type"),
            t("amount"),
            t("date"),
            t("description"),
          ],
          rows: filteredLosses.map((l) => [
            l.lossId ?? "",
            l.lossType ?? "",
            fmtCurrency(l.amount ?? 0, lang),
            toDateStr(l.date),
            l.description ?? "",
          ]),
          summary: [
            {
              label: t("totalLosses"),
              value: fmtCurrency(
                filteredLosses.reduce((a, l) => a + (l.amount ?? 0), 0),
                lang,
              ),
            },
          ],
        };
      case "expense":
        return {
          columns: [
            t("expenseId"),
            t("type"),
            t("amount"),
            t("date"),
            t("description"),
          ],
          rows: filteredExpenses.map((e) => [
            e.expenseId ?? "",
            e.type ?? "",
            fmtCurrency(e.amount ?? 0, lang),
            toDateStr(e.date),
            e.description ?? "",
          ]),
          summary: [
            {
              label: t("totalExpenses"),
              value: fmtCurrency(
                filteredExpenses.reduce((a, e) => a + (e.amount ?? 0), 0),
                lang,
              ),
            },
          ],
        };
      case "credit": {
        const creditCusts = customers.filter((c) => c.type === "credit");
        return {
          columns: [
            t("customerId"),
            t("name"),
            t("phone"),
            t("creditBalance"),
            t("creditLimit"),
            t("status"),
          ],
          rows: creditCusts.map((c) => [
            c.customerId ?? "",
            c.fullName ?? "",
            c.phone ?? "",
            fmtCurrency(c.creditBalance ?? 0, lang),
            fmtCurrency(c.creditLimit ?? 0, lang),
            t(c.status) || c.status,
          ]),
          summary: [
            {
              label: t("totalCreditCustomers"),
              value: String(creditCusts.length),
            },
            {
              label: t("totalOutstanding"),
              value: fmtCurrency(
                creditCusts.reduce((a, c) => a + (c.creditBalance ?? 0), 0),
                lang,
              ),
            },
          ],
        };
      }
      case "daily_summary":
      case "monthly_summary": {
        const rev = filteredSales.reduce((a, s) => a + (s.totalAmount ?? 0), 0);
        const exp = filteredExpenses.reduce((a, e) => a + (e.amount ?? 0), 0);
        const cost = filteredPurchases.reduce(
          (a, p) => a + (p.totalAmount ?? 0),
          0,
        );
        const totalL = filteredSales.reduce((a, s) => a + (s.liters ?? 0), 0);
        return {
          columns: [t("metric"), t("value")],
          rows: [
            [t("totalSalesLabel"), fmtCurrency(rev, lang)],
            [t("totalFuelCost"), fmtCurrency(cost, lang)],
            [t("totalExpenses"), fmtCurrency(exp, lang)],
            [t("netProfit"), fmtCurrency(rev - cost - exp, lang)],
            [t("totalTransactions"), String(filteredSales.length)],
            [t("totalLitersSold"), `${totalL}L`],
          ],
          summary: [
            { label: t("totalRevenue"), value: fmtCurrency(rev, lang) },
            {
              label: t("netProfit"),
              value: fmtCurrency(rev - cost - exp, lang),
            },
            {
              label: t("totalTransactions"),
              value: String(filteredSales.length),
            },
          ],
        };
      }
      default:
        return { columns: [], rows: [], summary: [] };
    }
  }

  const { columns, rows, summary } = getReportData();
  const meta = REPORT_META[reportType] ?? REPORT_META.daily_summary;
  const ReportIcon = meta.icon;

  return (
    <AppLayout title={t("reports")}>
      <div className="space-y-5">

        {/* ── Controls card ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">

              {/* Report type selector with icons */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ps" ? "د راپور ډول" : "Report Type"}
                </label>
                <Select value={reportType} onValueChange={handleReportTypeChange}>
                  <SelectTrigger className="h-9 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(periodLabel).map((k) => {
                      const m = REPORT_META[k];
                      const Icon = m?.icon ?? FiFileText;
                      return (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded ${m?.bg ?? "bg-muted"}`}>
                              <Icon className={`h-3 w-3 ${m?.color ?? "text-muted-foreground"}`} />
                            </span>
                            {periodLabel[k]}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ps" ? "له" : "From"}
                </label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-38" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ps" ? "تر" : "To"}
                </label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-38" />
              </div>

              {/* Actions */}
              <div className="ms-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <FiPrinter className="mr-1.5 h-4 w-4" /> {t("print")}
                </Button>
                <Button size="sm" onClick={handlePDF}>
                  <FiDownload className="mr-1.5 h-4 w-4" /> {t("exportPDF")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Report preview ────────────────────────────────────────────── */}
        <div ref={printRef} className="print:p-8">
          <Card>
            {/* Report header */}
            <CardHeader className={`rounded-t-xl border-b border-border ${meta.bg}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* Icon badge */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg} ring-2 ring-border`}>
                    <ReportIcon className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  <div>
                    <CardTitle className={`text-lg font-bold ${meta.color}`}>
                      {periodLabel[reportType]}
                    </CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("period")}: <span className="font-medium text-foreground">{dateFrom}</span>
                      {" "}{t("to")}{" "}
                      <span className="font-medium text-foreground">{dateTo}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("generated")}: {format(new Date(), "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                </div>
                {/* Record count badge */}
                {rows.length > 0 && (
                  <div className="rounded-lg border border-border bg-background/80 px-3 py-2 text-center">
                    <p className="text-2xl font-bold text-foreground">{rows.length}</p>
                    <p className="text-xs text-muted-foreground">{t("records")}</p>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5">
              {/* ── KPI Summary cards ─────────────────────────────────── */}
              {summary.length > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {summary.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`mt-1 text-lg font-bold ${kpiColor(s.label, s.value)}`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Data table ────────────────────────────────────────── */}
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${meta.bg}`}>
                    <ReportIcon className={`h-8 w-8 opacity-60 ${meta.color}`} />
                  </div>
                  <p className="text-sm font-medium">{t("noData")}</p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ps"
                      ? "د ټاکل شوي دورې لپاره ریکارډونه ونه موندل شول"
                      : "No records found for the selected date range"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full whitespace-nowrap">
                    <thead>
                      <tr className={`${meta.bg} border-b border-border`}>
                        {columns.map((col, i) => (
                          <th
                            key={col}
                            className={`px-4 py-2.5 text-xs font-semibold ${meta.color} ${i === 0 ? "text-start" : "text-start"}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody key={`${reportType}-${dateFrom}-${dateTo}`}>
                      {rows.map((row, i) => (
                        <tr
                          key={`${reportType}-${dateFrom}-${i}`}
                          className={`border-b border-border transition-colors last:border-0 ${
                            i % 2 === 0 ? "bg-background" : "bg-muted/30"
                          } hover:bg-primary/5`}
                        >
                          {row.map((cell, j) => {
                            // First column: monospace ID styling
                            if (j === 0) return (
                              <td key={j} className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                {cell}
                              </td>
                            );
                            // Amount-like cells (contain currency symbol or AFN)
                            const isAmount = typeof cell === "string" &&
                              (cell.includes("؋") || cell.includes("AFN") || cell.includes("$"));
                            return (
                              <td key={j} className={`px-4 py-2.5 text-sm ${isAmount ? "font-semibold" : ""}`}>
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/50">
                        <td colSpan={columns.length} className="px-4 py-2 text-xs text-muted-foreground">
                          {t("records")}: <span className="font-semibold text-foreground">{rows.length}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Signature section — print only */}
              <div className="mt-16 hidden items-end justify-between border-t border-border pt-8 print:flex">
                <div>
                  <div className="mb-1 h-px w-48 bg-foreground" />
                  <p className="text-xs">{t("managerSignature")}</p>
                </div>
                <div>
                  <div className="mb-1 h-px w-48 bg-foreground" />
                  <p className="text-xs">{t("authorizedBy")}</p>
                </div>
                <div>
                  <div className="mb-1 h-px w-48 bg-foreground" />
                  <p className="text-xs">{t("date")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
