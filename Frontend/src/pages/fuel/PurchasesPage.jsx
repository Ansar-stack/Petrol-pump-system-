import { useState, useMemo } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import toast from "react-hot-toast";

import { FiPlus, FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";

import { format } from "date-fns";

import { purchasesApi, fuelTypesApi, tanksApi } from "@/services/api";

import StatusBadge from "@/components/features/common/StatusBadge";
import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n, fmtCurrency, toArabicNum } from "@/components/context/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  supplierName: z.string().min(1, "Supplier is required"),
  fuelTypeId: z.string().min(1, "Fuel required"),
  quantity: z.coerce.number().min(1, "Quantity must be > 0"),
  pricePerLiter: z.coerce.number().min(0.001, "Price must be > 0"),
  tankId: z.string().min(1, "Tank is required"),
  date: z.string().min(1, "Date is required"),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]),
  notes: z.string().optional(),
});

export default function PurchasesPage() {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const [dialog, setDialog] = useState({ open: false });
  const [deleteId, setDeleteId] = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState("");   // supplier name or purchase ID
  const [fuelFilter,     setFuelFilter]     = useState("all");
  const [paymentFilter,  setPaymentFilter]  = useState("all");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: purchasesApi.getAll,
  });
  const { data: fuelTypes = [] } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });
  const { data: tanks = [] } = useQuery({
    queryKey: ["tanks"],
    queryFn: tanksApi.getAll,
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierName: "",
      fuelTypeId: "",
      quantity: 1000,
      pricePerLiter: 1.5,
      tankId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      paymentStatus: "unpaid",
      notes: "",
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["tanks"] });
  };

  const generateId = () =>
    `PUR-${String(purchases.length + 1).padStart(3, "0")}`;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await purchasesApi.create(data);
      // Update tank stock
      const tank = tanks.find((t) => t.id === data.tankId);
      if (tank) {
        await tanksApi.patch(tank.id, {
          currentStock: tank.currentStock + (data.quantity ?? 0),
        });
      }
      return result;
    },
    onSuccess: () => {
      toast.success(t("purchaseRecorded"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedCreate")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => purchasesApi.update(id, data),
    onSuccess: () => {
      toast.success(t("purchaseUpdated"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => purchasesApi.delete(id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      invalidate();
      setDeleteId(null);
    },
    onError: () => toast.error(t("failedDelete")),
  });

  const openCreate = () => {
    form.reset({
      supplierName: "",
      fuelTypeId: "",
      quantity: 1000,
      pricePerLiter: 1.5,
      tankId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      paymentStatus: "unpaid",
      notes: "",
    });
    setDialog({ open: true });
  };

  const openEdit = (item) => {
    form.reset({
      supplierName: item.supplierName,
      fuelTypeId: item.fuelTypeId,
      quantity: item.quantity,
      pricePerLiter: item.pricePerLiter,
      tankId: item.tankId,
      date: item.date,
      paymentStatus: item.paymentStatus,
      notes: item.notes,
    });
    setDialog({ open: true, item });
  };

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form is the designated stack
  const qty = form.watch("quantity");
  const price = form.watch("pricePerLiter");
  const totalAmount = (qty || 0) * (price || 0);

  const onSubmit = (values) => {
    values.quantity = toArabicNum(values.quantity);
    values.pricePerLiter = toArabicNum(values.pricePerLiter);
    values.totalAmount = toArabicNum(values.totalAmount);
    const data = {
      ...values,
      totalAmount,
      notes: values.notes ?? "",
      purchaseId: dialog.item?.purchaseId ?? generateId(),
    };
    if (dialog.item) updateMutation.mutate({ id: dialog.item.id, data });
    else createMutation.mutate(data);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...purchases]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((p) => {
        if (q && !p.supplierName.toLowerCase().includes(q) &&
            !p.purchaseId.toLowerCase().includes(q)) return false;
        if (fuelFilter    !== "all" && p.fuelTypeId     !== fuelFilter)    return false;
        if (paymentFilter !== "all" && p.paymentStatus  !== paymentFilter) return false;
        if (dateFrom && p.date < dateFrom) return false;
        if (dateTo   && p.date > dateTo)   return false;
        return true;
      });
  }, [purchases, search, fuelFilter, paymentFilter, dateFrom, dateTo]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalSpend   = filtered.reduce((s, p) => s + (p.totalAmount ?? 0), 0);
  const unpaidAmount = filtered
    .filter((p) => p.paymentStatus === "unpaid" || p.paymentStatus === "partial")
    .reduce((s, p) => s + (p.totalAmount ?? 0), 0);
  const totalLiters  = filtered.reduce((s, p) => s + (p.quantity ?? 0), 0);

  const hasFilter = search || fuelFilter !== "all" || paymentFilter !== "all" || dateFrom || dateTo;

  return (
    <AppLayout title={t("fuelPurchases")}>
      <div className="space-y-4">

        {/* ── Summary stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "ټول لګښت" : "Total Spend"}
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {fmtCurrency(totalSpend, lang)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filtered.length} {lang === "ps" ? "پیرودنې" : "purchases"} · {totalLiters.toLocaleString()}L
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "پاتې / نه‌تادیه" : "Unpaid / Partial"}
              </p>
              <p className={`mt-1 text-xl font-bold ${unpaidAmount > 0 ? "text-destructive" : "text-foreground"}`}>
                {fmtCurrency(unpaidAmount, lang)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filtered.filter((p) => p.paymentStatus !== "paid").length} {lang === "ps" ? "پاتې" : "pending"}
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "ټول لیتر پیرودل شوی" : "Total Liters Purchased"}
              </p>
              <p className="mt-1 text-xl font-bold text-primary">
                {totalLiters.toLocaleString()} L
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lang === "ps" ? "چاڼ شوي پایلې کې" : "in filtered results"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Main table card ───────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {t("fuelPurchases")}
                <Badge variant="secondary" className="font-mono text-xs">
                  {filtered.length}
                </Badge>
              </CardTitle>
              <Button size="sm" onClick={openCreate}>
                <FiPlus className="mr-1 h-4 w-4" />
                {t("addPurchase")}
              </Button>
            </div>

            {/* ── Filter bar ──────────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap items-end gap-2">

              {/* Search — supplier name or purchase ID */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`${t("supplier")} / ID...`}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Fuel type filter */}
              <Select value={fuelFilter} onValueChange={setFuelFilter}>
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue placeholder={t("fuel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")} — {t("fuel")}</SelectItem>
                  {fuelTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: ft.color ?? "#94a3b8" }}
                        />
                        {ft.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Payment status filter */}
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
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

              {/* Date from */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {lang === "ps" ? "له" : "From"}
                </span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>

              {/* Date to */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {lang === "ps" ? "تر" : "To"}
                </span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>

              {/* Clear all filters */}
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 self-end text-xs"
                  onClick={() => {
                    setSearch("");
                    setFuelFilter("all");
                    setPaymentFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  {lang === "ps" ? "پاکول ×" : "Clear ×"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {lang === "ps" ? "کوم پیرودنه ونه موندل شوه" : "No purchases match the current filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        "ID",
                        t("supplier"),
                        t("fuel"),
                        t("tanks"),
                        t("quantity"),
                        t("pricePerLiter"),
                        t("total"),
                        t("date"),
                        t("paymentStatus"),
                        t("actions"),
                      ].map((h) => (
                        <th
                          key={h}
                          className={`py-2 pr-4 text-xs font-medium text-muted-foreground first:ps-4 ${
                            h === t("actions") ? "text-end" : "text-start"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((p) => {
                      const ft   = fuelTypes.find((f) => f.id === p.fuelTypeId);
                      const tank = tanks.find((tk) => tk.id === p.tankId);
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-border transition-colors last:border-0 hover:bg-muted/30 ${
                            p.paymentStatus === "unpaid" ? "bg-destructive/5" : ""
                          }`}
                        >
                          <td className="py-3 pr-4 ps-4 font-mono text-xs text-muted-foreground">
                            {p.purchaseId}
                          </td>
                          <td className="py-3 pr-4 text-sm font-medium">
                            {p.supplierName}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: ft?.color ?? "#94a3b8" }}
                              />
                              <span className="text-sm">{ft?.name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {tank?.name ?? "—"}
                          </td>
                          <td className="py-3 pr-4 text-sm">
                            {p.quantity.toLocaleString()}L
                          </td>
                          <td className="py-3 pr-4 text-sm">
                            {fmtCurrency(p.pricePerLiter, lang, 3)}
                          </td>
                          <td className="py-3 pr-4 text-sm font-semibold">
                            {fmtCurrency(p.totalAmount, lang)}
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {p.date}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={p.paymentStatus} />
                          </td>
                          <td className="py-3 pe-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(p)}
                                className="h-8 w-8 p-0"
                                title={t("edit")}
                              >
                                <FiEdit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(p.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title={t("delete")}
                              >
                                <FiTrash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
            <DialogTitle>
              {dialog.item ? t("editPurchase") : t("addPurchase")}
            </DialogTitle>
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
                      <Input placeholder="National Fuel Co." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fuelTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fuel")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectFuel")} />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          {fuelTypes.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tankId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("assignToTank")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("assignToTank")} />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          {tanks.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("quantity")}</FormLabel>
                      <FormControl>
                        <PashtoInput type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricePerLiter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pricePerLiterLabel")}</FormLabel>
                      <FormControl>
                        <PashtoInput type="number" step="0.001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                Total Amount:{" "}
                <span className="font-bold text-foreground">
                  {fmtCurrency(totalAmount, lang)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("date")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("paymentStatus")}</FormLabel>
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
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
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
                      <Textarea rows={2} {...field} />
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
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {dialog.item ? t("update") : t("add")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this purchase record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
