import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiDroplet,
} from "react-icons/fi";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

import {
  salesApi,
  purchasesApi,
  expensesApi,
  lossesApi,
  fuelTypesApi,
} from "@/services/api";

import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n, fmtCurrency } from "@/components/context/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = [
  "hsl(183,76%,26%)",
  "hsl(22,85%,52%)",
  "hsl(280,60%,50%)",
  "hsl(142,72%,29%)",
];

function getDateRange(period) {
  const now = new Date();
  const fmt = (d) => format(d, "yyyy-MM-dd");
  switch (period) {
    case "today":
      return { start: fmt(now), end: fmt(now) };
    case "week":
      return { start: fmt(startOfWeek(now)), end: fmt(endOfWeek(now)) };
    case "month":
      return { start: fmt(startOfMonth(now)), end: fmt(endOfMonth(now)) };
    default:
      return { start: "2000-01-01", end: fmt(now) };
  }
}

function inRange(dateStr, range) {
  return dateStr >= range.start && dateStr <= range.end;
}

function rowValueColor(row) {
  if (row.value < 0) return "text-destructive";
  if (row.type === "income") return "text-green-600 dark:text-green-400";
  if (row.type === "cost") return "text-destructive";
  return "text-foreground";
}

export default function ProfitLossPage() {
  const [period, setPeriod] = useState("month");
  const { t, lang } = useI18n();
  const range = getDateRange(period);

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
  const { data: fuelTypes = [] } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });

  const pSales = sales.filter((s) => inRange(s.date.substring(0, 10), range));
  const pPurchases = purchases.filter((p) => inRange(p.date, range));
  const pExpenses = expenses.filter((e) => inRange(e.date, range));
  const pLosses = losses.filter((l) => inRange(l.date, range));

  const totalRevenue = pSales.reduce((a, s) => a + s.totalAmount, 0);
  const fuelCost = pPurchases.reduce((a, p) => a + p.totalAmount, 0);
  const totalExpenses = pExpenses.reduce((a, e) => a + e.amount, 0);
  const totalLosses = pLosses.reduce((a, l) => a + l.amount, 0);
  const grossProfit = totalRevenue - fuelCost;
  const netProfit = grossProfit - totalExpenses - totalLosses;

  // Fuel-wise profit
  const fuelWise = fuelTypes
    .map((ft) => {
      const ftSales = pSales.filter((s) => s.fuelTypeId === ft.id);
      const ftPurchases = pPurchases.filter((p) => p.fuelTypeId === ft.id);
      const rev = ftSales.reduce((a, s) => a + s.totalAmount, 0);
      const cost = ftPurchases.reduce((a, p) => a + p.totalAmount, 0);
      return { name: ft.name, revenue: rev, cost, profit: rev - cost };
    })
    .filter((f) => f.revenue > 0 || f.cost > 0);

  // Last 30 days daily profit
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const ds = format(d, "yyyy-MM-dd");
    const rev = sales
      .filter((s) => s.date.startsWith(ds))
      .reduce((a, s) => a + s.totalAmount, 0);
    const exp = expenses
      .filter((e) => e.date === ds)
      .reduce((a, e) => a + e.amount, 0);
    return { date: format(d, "MMM dd"), profit: rev - exp };
  });

  // Loss breakdown
  const LOSS_TYPE_KEYS = [
    "Fuel Leakage",
    "Pump Damage",
    "Price Difference",
    "Other",
  ];
  const lossTypes = LOSS_TYPE_KEYS.map((lt) => ({
    name: lt,
    value: pLosses
      .filter((l) => l.lossType === lt)
      .reduce((a, l) => a + l.amount, 0),
  })).filter((l) => l.value > 0);

  return (
    <AppLayout title={t("profitLossTitle")}>
      <div className="space-y-6">
        {/* Period filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Period:</span>
          <Select value={period} onValueChange={(v) => setPeriod(v)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">{t("thisWeek")}</SelectItem>
              <SelectItem value="month">{t("thisMonth")}</SelectItem>
              <SelectItem value="all">{t("allTime")}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {range.start} → {range.end}
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: t("totalRevenue"),
              value: totalRevenue,
              icon: FiDollarSign,
              color: "bg-primary/10 text-primary",
              positive: true,
            },
            {
              label: t("fuelCost"),
              value: fuelCost,
              icon: FiDroplet,
              color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
              positive: false,
            },
            {
              label: t("totalExpenses"),
              value: totalExpenses,
              icon: FiTrendingDown,
              color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
              positive: false,
            },
            {
              label: t("netProfit"),
              value: netProfit,
              icon: FiTrendingUp,
              color:
                netProfit >= 0
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 text-destructive",
              positive: netProfit >= 0,
            },
          ].map((kpi) => (
            <Card key={kpi.label} className="h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-pretty text-xs text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p
                      className={`mt-1 text-xl font-bold ${kpi.value < 0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {fmtCurrency(Math.abs(kpi.value), lang)}
                    </p>
                  </div>
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}
                  >
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* P&L Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("plSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: t("revenue"), value: totalRevenue, type: "income" },
                { label: `- ${t("fuelCost")}`, value: fuelCost, type: "cost" },
                { label: t("profit"), value: grossProfit, type: "gross" },
                {
                  label: `- ${t("expenses")}`,
                  value: totalExpenses,
                  type: "cost",
                },
                { label: `- ${t("loss")}`, value: totalLosses, type: "cost" },
                { label: `= ${t("netProfit")}`, value: netProfit, type: "net" },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${row.type === "gross" || row.type === "net" ? "bg-muted font-semibold" : ""}`}
                >
                  <span
                    className={`text-sm ${row.type === "net" ? "font-bold" : ""}`}
                  >
                    {row.label}
                  </span>
                  <span
                    className={`text-sm font-semibold ${rowValueColor(row)}`}
                  >
                    {row.value < 0 ? "-" : ""}
                    {fmtCurrency(Math.abs(row.value), lang)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">{t("dailyTrend")}</TabsTrigger>
            <TabsTrigger value="fuel">{t("fuelBreakdown")}</TabsTrigger>
            <TabsTrigger value="losses">{t("loss")}</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Daily Profit (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="w-full min-w-0 overflow-hidden"
                  style={{ height: 250 }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={last30}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval={4}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Bar
                        dataKey="profit"
                        name={t("netProfit")}
                        radius={[3, 3, 0, 0]}
                        fill="hsl(183,76%,26%)"
                        label={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fuel">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Profit by Fuel Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border">
                        {[
                          t("fuel"),
                          t("revenue"),
                          t("fuelCost"),
                          t("profit"),
                          t("margin"),
                        ].map((h) => (
                          <th
                            key={h}
                            className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {fuelWise.map((f) => (
                        <tr
                          key={f.name}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-2 pr-4 text-sm font-medium">
                            {f.name}
                          </td>
                          <td className="py-2 pr-4 text-sm text-green-600 dark:text-green-400">
                            {fmtCurrency(f.revenue, lang)}
                          </td>
                          <td className="py-2 pr-4 text-sm text-destructive">
                            {fmtCurrency(f.cost, lang)}
                          </td>
                          <td className="py-2 pr-4 text-sm font-semibold">
                            {fmtCurrency(f.profit, lang)}
                          </td>
                          <td className="py-2 pr-4 text-sm text-muted-foreground">
                            {f.revenue > 0
                              ? ((f.profit / f.revenue) * 100).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>
                      ))}
                      {fuelWise.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            No data for selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="losses">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Loss Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {lossTypes.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div
                      className="w-full min-w-0 overflow-hidden"
                      style={{ height: 220 }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={lossTypes}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            paddingAngle={3}
                          >
                            {lossTypes.map((entry, i) => (
                              <Cell
                                key={entry.name}
                                fill={COLORS[i % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v) => [fmtCurrency(v, lang), ""]}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                            }}
                          />
                          <Legend
                            layout="horizontal"
                            wrapperStyle={{ paddingTop: 8 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {lossTypes.map((l) => (
                        <div
                          key={l.name}
                          className="flex items-center justify-between rounded-lg bg-muted p-2"
                        >
                          <span className="text-sm">{l.name}</span>
                          <span className="text-sm font-semibold text-destructive">
                            {fmtCurrency(l.value, lang)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 p-2">
                        <span className="text-sm font-semibold">
                          Total Losses
                        </span>
                        <span className="text-sm font-bold text-destructive">
                          {fmtCurrency(totalLosses, lang)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No losses recorded for this period
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
