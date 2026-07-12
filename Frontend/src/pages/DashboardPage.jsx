import { useQuery } from "@tanstack/react-query";

import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiDroplet,
  FiUsers,
  FiAlertTriangle,
  FiShoppingCart,
  FiCreditCard,
  FiActivity,
} from "react-icons/fi";

import {
  AreaChart,
  Area,
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

import { format } from "date-fns";

import {
  salesApi,
  expensesApi,
  purchasesApi,
  tanksApi,
  customersApi,
  fuelTypesApi,
} from "@/services/api";

import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n, fmtCurrency } from "@/components/context/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const COLORS = [
  "hsl(183,76%,26%)",
  "hsl(22,85%,52%)",
  "hsl(280,60%,50%)",
  "hsl(142,72%,29%)",
];

function KPICard({ title, value, sub, icon: Icon, trend, trendLabel, color }) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-pretty text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-balance text-2xl font-bold text-foreground">
              {value}
            </p>
            {sub && (
              <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
            )}
            {trendLabel && (
              <div
                className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                {trend === "up" ? (
                  <FiTrendingUp className="h-3 w-3" />
                ) : (
                  <FiTrendingDown className="h-3 w-3" />
                )}
                {trendLabel}
              </div>
            )}
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TankCard({ tank, fuelType }) {
  const pct = Math.round((tank.currentStock / tank.capacity) * 100);
  const isLow = tank.currentStock < tank.minimumLevel;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {tank.name}
          </span>
          {isLow && (
            <Badge variant="destructive" className="px-1.5 py-0 text-xs">
              Low Stock
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {fuelType?.name ?? "-"} • {tank.currentStock.toLocaleString()}L /{" "}
          {tank.capacity.toLocaleString()}L
        </p>
        <Progress
          value={pct}
          className={`mt-1.5 h-1.5 ${isLow ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
        />
      </div>
      <span
        className={`shrink-0 text-sm font-semibold ${isLow ? "text-destructive" : "text-foreground"}`}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { t, lang } = useI18n();
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: salesApi.getAll,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: expensesApi.getAll,
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: purchasesApi.getAll,
  });
  const { data: tanks = [] } = useQuery({
    queryKey: ["tanks"],
    queryFn: tanksApi.getAll,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.getAll,
  });
  const { data: fuelTypes = [] } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });

  // KPI calculations
  const todaySales = sales.filter((s) => s.date.startsWith(today));
  const todayRevenue = todaySales.reduce((a, s) => a + s.totalAmount, 0);
  const todayExpenses = expenses
    .filter((e) => e.date === today)
    .reduce((a, e) => a + e.amount, 0);
  const totalFuelCost = purchases.reduce((a, p) => a + p.totalAmount, 0);
  const totalRevenue = sales.reduce((a, s) => a + s.totalAmount, 0);
  const totalExpensesSum = expenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = totalRevenue - totalFuelCost - totalExpensesSum;
  const todayProfit = todayRevenue - todayExpenses;

  const creditCustomers = customers.filter((c) => c.type === "credit");
  const outstandingCredit = creditCustomers.reduce(
    (a, c) => a + c.creditBalance,
    0,
  );
  const lowTanks = tanks.filter((t) => t.currentStock < t.minimumLevel);

  // Last 7 days sales chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = format(d, "yyyy-MM-dd");
    const daySales = sales.filter((s) => s.date.startsWith(dateStr));
    const dayExpense = expenses.filter((e) => e.date === dateStr);
    return {
      date: format(d, "MMM dd"),
      revenue: daySales.reduce((a, s) => a + s.totalAmount, 0),
      expenses: dayExpense.reduce((a, e) => a + e.amount, 0),
      profit:
        daySales.reduce((a, s) => a + s.totalAmount, 0) -
        dayExpense.reduce((a, e) => a + e.amount, 0),
    };
  });

  // Fuel sales by type
  const fuelSalesData = fuelTypes
    .map((ft) => {
      const ftSales = sales.filter((s) => s.fuelTypeId === ft.id);
      return {
        name: ft.name,
        liters: ftSales.reduce((a, s) => a + s.liters, 0),
        revenue: ftSales.reduce((a, s) => a + s.totalAmount, 0),
      };
    })
    .filter((d) => d.liters > 0);

  // Payment method breakdown
  const payMethods = ["cash", "card", "credit"]
    .map((m) => ({
      name: m.charAt(0).toUpperCase() + m.slice(1),
      value: sales
        .filter((s) => s.paymentMethod === m)
        .reduce((a, s) => a + s.totalAmount, 0),
    }))
    .filter((d) => d.value > 0);

  return (
    <AppLayout title={t("dashboard")}>
      <div className="space-y-6">
        {/* Alerts */}
        {lowTanks.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive">
            <FiAlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              {t("lowStockAlert")}: {lowTanks.map((tnk) => tnk.name).join(", ")}{" "}
              {t("needRestocking")}
            </p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard
            title={t("todayRevenue")}
            value={fmtCurrency(todayRevenue, lang)}
            sub={`${todaySales.length} ${t("transactions")}`}
            icon={FiDollarSign}
            trend="up"
            trendLabel={`${todaySales.length} ${t("salesToday")}`}
            color="bg-primary/10 text-primary"
          />
          <KPICard
            title={t("todayProfit")}
            value={fmtCurrency(todayProfit, lang)}
            icon={FiTrendingUp}
            trend={todayProfit >= 0 ? "up" : "down"}
            trendLabel={t("vsYesterday")}
            color="bg-green-500/10 text-green-600 dark:text-green-400"
          />
          <KPICard
            title={t("todayExpenses")}
            value={fmtCurrency(todayExpenses, lang)}
            icon={FiDollarSign}
            color="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          />
          <KPICard
            title={t("netProfitAllTime")}
            value={fmtCurrency(netProfit, lang)}
            icon={FiActivity}
            trend={netProfit >= 0 ? "up" : "down"}
            color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* Second row KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard
            title={t("totalSales")}
            value={fmtCurrency(totalRevenue, lang)}
            sub={`${sales.length} ${t("transactions")}`}
            icon={FiShoppingCart}
            color="bg-primary/10 text-primary"
          />
          <KPICard
            title={t("totalFuelSold")}
            value={`${sales.reduce((a, s) => a + s.liters, 0).toLocaleString()}L`}
            icon={FiDroplet}
            color="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          />
          <KPICard
            title={t("creditCustomers")}
            value={`${creditCustomers.length}`}
            sub={`${customers.filter((c) => c.status === "active").length} active`}
            icon={FiUsers}
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <KPICard
            title={t("outstandingCredit")}
            value={fmtCurrency(outstandingCredit, lang)}
            icon={FiCreditCard}
            trend="down"
            trendLabel={t("outstandingCredit")}
            color="bg-red-500/10 text-red-600 dark:text-red-400"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Revenue vs Expenses – 2/3 width */}
          <Card className="h-full md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("revenueVsExpenses")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className="w-full min-w-0 overflow-hidden"
                style={{ height: 220 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={last7Days}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(183,76%,26%)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(183,76%,26%)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(22,85%,52%)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(22,85%,52%)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
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
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend
                      layout="horizontal"
                      wrapperStyle={{ paddingTop: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(183,76%,26%)"
                      fill="url(#colorRev)"
                      strokeWidth={2}
                      name={t("revenue")}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="hsl(22,85%,52%)"
                      fill="url(#colorExp)"
                      strokeWidth={2}
                      name={t("expenses")}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment breakdown */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("paymentMethodsDist")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className="w-full min-w-0 overflow-hidden"
                style={{ height: 220 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payMethods}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={3}
                    >
                      {payMethods.map((entry, i) => (
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
                      wrapperStyle={{ paddingTop: 4 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Fuel Sales by Type */}
          <Card className="h-full md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("fuelSalesByType")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className="w-full min-w-0 overflow-hidden"
                style={{ height: 200 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fuelSalesData}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
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
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar
                      dataKey="liters"
                      fill="hsl(183,76%,26%)"
                      radius={[4, 4, 0, 0]}
                      name={t("liters")}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tank Status */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {t("tankLevels")}
                </CardTitle>
                {lowTanks.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {lowTanks.length} Low
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 divide-y divide-border">
                {tanks.map((tank) => (
                  <TankCard
                    key={tank.id}
                    tank={tank}
                    fuelType={fuelTypes.find((f) => f.id === tank.fuelTypeId)}
                  />
                ))}
                {tanks.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("noData")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* {t('recentSales')} */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t("recentSales")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                      {t("transactionId")}
                    </th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                      {t("customer")}
                    </th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                      {t("fuel")}
                    </th>
                    <th className="py-2 pr-4 text-right text-xs font-medium text-muted-foreground">
                      {t("liters")}
                    </th>
                    <th className="py-2 pr-4 text-right text-xs font-medium text-muted-foreground">
                      {t("amount")}
                    </th>
                    <th className="py-2 text-left text-xs font-medium text-muted-foreground">
                      {t("method")}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[...sales]
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
                    )
                    .slice(0, 6)
                    .map((sale) => {
                      const ft = fuelTypes.find(
                        (f) => f.id === sale.fuelTypeId,
                      );
                      return (
                        <tr
                          key={sale.id}
                          className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                            {sale.transactionId}
                          </td>
                          <td className="py-2 pr-4 text-sm">
                            {sale.customerName}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: ft?.color }}
                              />
                              {ft?.name}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right text-sm">
                            {sale.liters}L
                          </td>
                          <td className="py-2 pr-4 text-right text-sm font-semibold">
                            {fmtCurrency(sale.totalAmount, lang)}
                          </td>
                          <td className="py-2 text-xs capitalize">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                              {sale.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Receipt(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}
