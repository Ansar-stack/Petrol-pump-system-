import { useState, useMemo } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import toast from "react-hot-toast";

import { FiPlus, FiTrash2, FiSearch, FiDollarSign, FiAlertCircle } from "react-icons/fi";

import { format } from "date-fns";

import {
  purchasesApi,
  supplierPaymentsApi,
  fuelTypesApi,
} from "@/services/api";

import StatusBadge from "@/components/features/common/StatusBadge";
import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n, fmtCurrency, toArabicNum } from "@/components/context/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import PashtoInput from "@/components/ui/pashto-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const paySchema = z.object({
  supplierName: z.string().min(1),
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.string().min(1),
  purchaseId: z.string().min(1),
  notes: z.string().optional(),
});

export default function AccountsPayablePage() {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const [dialog, setDialog] = useState({ open: false });

  // ── Supplier Balances filters ─────────────────────────────────────────────
  const [supplierSearch,  setSupplierSearch]  = useState("");
  const [balanceStatus,   setBalanceStatus]   = useState("all"); // all|paid|partial|unpaid

  // ── Payment History filters ───────────────────────────────────────────────
  const [historySearch,   setHistorySearch]   = useState("");
  const [methodFilter,    setMethodFilter]    = useState("all");
  const [historyFrom,     setHistoryFrom]     = useState("");
  const [historyTo,       setHistoryTo]       = useState("");

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: purchasesApi.getAll,
  });
  const { data: supplierPayments = [] } = useQuery({
    queryKey: ["supplierPayments"],
    queryFn: supplierPaymentsApi.getAll,
  });
  const { data: fuelTypes = [] } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });

  const form = useForm({
    resolver: zodResolver(paySchema),
    defaultValues: {
      supplierName: "",
      amount: 0,
      paymentMethod: "bank_transfer",
      purchaseId: "",
      notes: "",
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["supplierPayments"] });
    qc.invalidateQueries({ queryKey: ["purchases"] });
  };

  const payMutation = useMutation({
    mutationFn: async (data) => {
      const result = await supplierPaymentsApi.create(data);
      // Update purchase payment status
      const purchase = purchases.find((p) => p.id === data.purchaseId);
      if (purchase) {
        const totalPaid =
          supplierPayments
            .filter((sp) => sp.purchaseId === purchase.id)
            .reduce((a, sp) => a + sp.amount, 0) + (data.amount ?? 0);
        const newStatus =
          totalPaid >= purchase.totalAmount ? "paid" : "partial";
        await purchasesApi.update(purchase.id, { paymentStatus: newStatus });
      }
      return result;
    },
    onSuccess: () => {
      toast.success(t("paymentAdded"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedRecord")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => supplierPaymentsApi.delete(id),
    onSuccess: () => {
      toast.success(t("paymentDeleted"));
      invalidate();
    },
    onError: () => toast.error(t("failedDelete")),
  });

  const onSubmit = (values) => {
    values.amount = toArabicNum(values.amount);
    payMutation.mutate({
      paymentId: `PAY-${String(supplierPayments.length + 1).padStart(3, "0")}`,
      ...values,
      date: format(new Date(), "yyyy-MM-dd"),
      notes: values.notes ?? "",
    });
  };

  // ── Supplier summary (all, unfiltered — for stats) ───────────────────────
  const allSupplierSummary = useMemo(() => {
    const names = [...new Set(purchases.map((p) => p.supplierName))];
    return names.map((name) => {
      const supPurchases = purchases.filter((p) => p.supplierName === name);
      const supPayments  = supplierPayments.filter((sp) => sp.supplierName === name);
      const totalPurchased = supPurchases.reduce((a, p)  => a + p.totalAmount, 0);
      const totalPaid      = supPayments.reduce((a, sp)  => a + sp.amount,     0);
      const balance        = totalPurchased - totalPaid;
      const status         = balance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
      return { name, totalPurchased, totalPaid, balance, status };
    });
  }, [purchases, supplierPayments]);

  // ── Filtered supplier summary ─────────────────────────────────────────────
  const supplierSummary = useMemo(() => {
    return allSupplierSummary.filter((s) => {
      if (supplierSearch && !s.name.toLowerCase().includes(supplierSearch.toLowerCase())) return false;
      if (balanceStatus !== "all" && s.status !== balanceStatus) return false;
      return true;
    });
  }, [allSupplierSummary, supplierSearch, balanceStatus]);

  // ── Filtered payment history ──────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    return [...supplierPayments]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((sp) => {
        if (q && !sp.supplierName.toLowerCase().includes(q) &&
            !sp.paymentId.toLowerCase().includes(q) &&
            !(sp.purchaseId ?? "").toLowerCase().includes(q)) return false;
        if (methodFilter !== "all" && sp.paymentMethod !== methodFilter) return false;
        if (historyFrom && sp.date < historyFrom) return false;
        if (historyTo   && sp.date > historyTo)   return false;
        return true;
      });
  }, [supplierPayments, historySearch, methodFilter, historyFrom, historyTo]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalOwed      = allSupplierSummary.reduce((s, x) => s + x.balance, 0);
  const totalPaidAll   = allSupplierSummary.reduce((s, x) => s + x.totalPaid, 0);
  const unpaidCount    = allSupplierSummary.filter((s) => s.status === "unpaid").length;
  const partialCount   = allSupplierSummary.filter((s) => s.status === "partial").length;

  const hasSupplierFilter = supplierSearch || balanceStatus !== "all";
  const hasHistoryFilter  = historySearch || methodFilter !== "all" || historyFrom || historyTo;

  const unpaidPurchases = purchases.filter((p) => p.paymentStatus !== "paid");

  return (
    <AppLayout title={t("accountsPayableTitle")}>
      <div className="space-y-5">

        {/* ── Summary stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Total owed */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ps" ? "ټول پاتې" : "Total Outstanding"}
                  </p>
                  <p className={`mt-1 text-xl font-bold ${totalOwed > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {fmtCurrency(totalOwed, lang)}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <FiAlertCircle className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total paid */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalPaid")}</p>
                  <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">
                    {fmtCurrency(totalPaidAll, lang)}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <FiDollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unpaid suppliers */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{lang === "ps" ? "نه‌تادیه" : "Unpaid Suppliers"}</p>
              <p className="mt-1 text-xl font-bold text-destructive">{unpaidCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {partialCount} {lang === "ps" ? "جزوي" : "partial"}
              </p>
            </CardContent>
          </Card>

          {/* Payment history count */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "د تادیو شمیر" : "Payments Made"}
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{supplierPayments.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lang === "ps" ? "ټول ثبت شوي تادیات" : "total recorded payments"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Supplier Balances ────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {lang === "ps" ? "د عرضه‌کوونکو بیلانس" : "Supplier Balances"}
                <Badge variant="secondary" className="font-mono text-xs">{supplierSummary.length}</Badge>
              </CardTitle>
              <Button size="sm" onClick={() => { form.reset(); setDialog({ open: true }); }}>
                <FiPlus className="mr-1 h-4 w-4" />
                {lang === "ps" ? "تادیه ثبت کول" : "Record Payment"}
              </Button>
            </div>

            {/* Supplier filter bar */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder={`${t("supplier")}...`}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Balance status filter */}
              <Select value={balanceStatus} onValueChange={setBalanceStatus}>
                <SelectTrigger className="h-8 w-[130px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")}</SelectItem>
                  <SelectItem value="paid">{t("paid")}</SelectItem>
                  <SelectItem value="partial">{t("partial")}</SelectItem>
                  <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear */}
              {hasSupplierFilter && (
                <Button variant="ghost" size="sm" className="h-8 text-xs"
                  onClick={() => { setSupplierSearch(""); setBalanceStatus("all"); }}>
                  {lang === "ps" ? "پاکول ×" : "Clear ×"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    {[t("supplier"), t("totalPurchased"), t("totalPaid"), t("balance"), t("status")].map((h) => (
                      <th key={h} className="py-2 pr-4 ps-4 text-start text-xs font-medium text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supplierSummary.map((s) => (
                    <tr key={s.name}
                      className={`border-b border-border transition-colors last:border-0 hover:bg-muted/30 ${
                        s.status === "unpaid" ? "bg-destructive/5" : ""
                      }`}>
                      <td className="py-3 pr-4 ps-4 text-sm font-medium">{s.name}</td>
                      <td className="py-3 pr-4 text-sm">{fmtCurrency(s.totalPurchased, lang)}</td>
                      <td className="py-3 pr-4 text-sm text-green-600 dark:text-green-400">
                        {fmtCurrency(s.totalPaid, lang)}
                      </td>
                      <td className={`py-3 pr-4 text-sm font-semibold ${s.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                        {fmtCurrency(s.balance, lang)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                  {supplierSummary.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {lang === "ps" ? "کوم ریکارډ ونه موندل شو" : "No suppliers match the current filters"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Payment History ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {lang === "ps" ? "د تادیو تاریخچه" : "Payment History"}
                <Badge variant="secondary" className="font-mono text-xs">{filteredHistory.length}</Badge>
              </CardTitle>
            </div>

            {/* Payment history filter bar */}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {/* Search — payment ID, supplier, purchase ref */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={`${t("supplier")} / ID / ${t("purchaseRef")}...`}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Payment method filter */}
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-8 w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")} — {t("method")}</SelectItem>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("bankTransfer")}</SelectItem>
                  <SelectItem value="card">{t("card")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Date from */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">{lang === "ps" ? "له" : "From"}</span>
                <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="h-8 w-36 text-sm" />
              </div>

              {/* Date to */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">{lang === "ps" ? "تر" : "To"}</span>
                <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="h-8 w-36 text-sm" />
              </div>

              {/* Clear */}
              {hasHistoryFilter && (
                <Button variant="ghost" size="sm" className="h-8 self-end text-xs"
                  onClick={() => { setHistorySearch(""); setMethodFilter("all"); setHistoryFrom(""); setHistoryTo(""); }}>
                  {lang === "ps" ? "پاکول ×" : "Clear ×"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {lang === "ps" ? "کوم تادیه ونه موندل شوه" : "No payments match the current filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        "ID", t("supplier"), t("amount"), t("method"),
                        t("date"), t("purchaseRef"), t("notes"), t("actions"),
                      ].map((h) => (
                        <th key={h}
                          className={`py-2 pr-4 text-xs font-medium text-muted-foreground first:ps-4 ${h === t("actions") ? "text-end" : "text-start"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((sp) => (
                      <tr key={sp.id}
                        className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
                        <td className="py-3 pr-4 ps-4 font-mono text-xs text-muted-foreground">{sp.paymentId}</td>
                        <td className="py-3 pr-4 text-sm font-medium">{sp.supplierName}</td>
                        <td className="py-3 pr-4 text-sm font-semibold text-green-600 dark:text-green-400">
                          {fmtCurrency(sp.amount, lang)}
                        </td>
                        <td className="py-3 pr-4 text-sm capitalize text-muted-foreground">
                          {sp.paymentMethod?.replace("_", " ")}
                        </td>
                        <td className="py-3 pr-4 text-sm text-muted-foreground">{sp.date}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{sp.purchaseId}</td>
                        <td className="py-3 pr-4 max-w-[160px] truncate text-sm text-muted-foreground">
                          {sp.notes || "—"}
                        </td>
                        <td className="py-3 pe-3 text-end">
                          <Button variant="ghost" size="sm"
                            onClick={() => deleteMutation.mutate(sp.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title={t("delete")}>
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Supplier Payment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="supplierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("supplier")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("purchaseRef")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const p = purchases.find((pu) => pu.id === v);
                        if (p) form.setValue("supplierName", p.supplierName);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectType")} />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        {unpaidPurchases.map((p) => {
                          const ft = fuelTypes.find(
                            (f) => f.id === p.fuelTypeId,
                          );
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              {p.purchaseId} — {p.supplierName} —{" "}
                              {fmtCurrency(p.totalAmount, lang)} ({ft?.name})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("amountLabel")}</FormLabel>
                      <FormControl>
                        <PashtoInput type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("method")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("notes")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDialog({ open: false })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={payMutation.isPending}>
                  Record Payment
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
