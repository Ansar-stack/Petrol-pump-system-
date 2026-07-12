import { useState, useMemo } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import toast from "react-hot-toast";

import { FiPlus, FiEdit2, FiTrash2, FiCreditCard, FiSearch } from "react-icons/fi";

import { format } from "date-fns";

import { cashStoragesApi } from "@/services/api";

import AppLayout from "@/components/features/layouts/AppLayout";
import {
  useI18n,
  fmtCurrency,
  fmtByCurrency,
  toArabicNum,
} from "@/components/context/i18n";
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
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Bank Account", "Sarafi", "Office Safe", "Treasury"]),
  balance: z.coerce.number().min(0),
  currency: z.string().min(1),
  notes: z.string().optional(),
});

const typeIcons = {
  "Bank Account": "🏦",
  Sarafi: "💱",
  "Office Safe": "🔒",
  Treasury: "🏛️",
};

export default function CashStoragePage() {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const [dialog, setDialog]   = useState({ open: false });
  const [deleteId, setDeleteId] = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");   // name or storage ID
  const [typeFilter,  setTypeFilter]  = useState("all");
  const [currFilter,  setCurrFilter]  = useState("all");

  const { data: storages = [], isLoading } = useQuery({
    queryKey: ["cashStorages"],
    queryFn: cashStoragesApi.getAll,
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "Office Safe",
      balance: 0,
      currency: "AFN",
      notes: "",
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cashStorages"] });

  const generateId = () =>
    `STR-${String(storages.length + 1).padStart(3, "0")}`;

  const createMutation = useMutation({
    mutationFn: (d) => cashStoragesApi.create(d),
    onSuccess: () => {
      toast.success(t("storageAdded"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedCreate")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => cashStoragesApi.update(id, data),
    onSuccess: () => {
      toast.success(t("storageUpdated"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedUpdate")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => cashStoragesApi.delete(id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      invalidate();
      setDeleteId(null);
    },
    onError: () => toast.error(t("failedDelete")),
  });

  const openCreate = () => {
    form.reset({ name: "", type: "Office Safe", balance: 0, currency: "AFN", notes: "" });
    setDialog({ open: true });
  };

  const openEdit = (item) => {
    form.reset({
      name:     item.name,
      type:     item.type,        // fixed: was item.StorageType (wrong field)
      balance:  item.balance,
      currency: item.currency,
      notes:    item.notes ?? "",
    });
    setDialog({ open: true, item });
  };

  const onSubmit = (values) => {
    values.amount = toArabicNum(values.amount);
    const data = {
      ...values,
      storageId:   dialog.item?.storageId ?? generateId(),
      notes:       values.notes ?? "",
      lastUpdated: format(new Date(), "yyyy-MM-dd"),
    };
    if (dialog.item) updateMutation.mutate({ id: dialog.item.id, data });
    else createMutation.mutate(data);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return storages.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) &&
          !(s.storageId ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && s.type     !== typeFilter) return false;
      if (currFilter !== "all" && s.currency !== currFilter) return false;
      return true;
    });
  }, [storages, search, typeFilter, currFilter]);

  const hasFilter = search || typeFilter !== "all" || currFilter !== "all";

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalBalance = storages.reduce((a, s) => a + s.balance, 0);
  const filteredTotal = filtered.reduce((a, s) => a + s.balance, 0);

  // Group filtered storages by type + currency for the summary cards
  const groups = useMemo(() => Object.values(
    filtered.reduce((acc, s) => {
      const key = `${s.type}||${s.currency}`;
      if (!acc[key]) acc[key] = { type: s.type, currency: s.currency, items: [] };
      acc[key].items.push(s);
      return acc;
    }, {}),
  ), [filtered]);

  return (
    <AppLayout title={t("cashStorageTitle")}>
      <div className="space-y-6">
        {/* Summary cards — one card per unique type+currency group */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const groupTotal = g.items.reduce((a, s) => a + s.balance, 0);
            return (
              <Card key={`${g.type}||${g.currency}`} className="h-full">
                <CardContent className="p-4">
                  {/* Group header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {typeIcons[g.type] ?? "💰"}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {g.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {g.currency}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-base font-bold text-primary">
                        {fmtByCurrency(groupTotal, g.currency)}
                      </p>
                    </div>
                  </div>
                  {/* Individual entries in this group */}
                  <div className="space-y-1.5 border-t border-border pt-3">
                    {g.items.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between"
                      >
                        <p className="min-w-0 truncate text-xs text-muted-foreground">
                          {s.name}
                        </p>
                        <p className="ms-2 shrink-0 text-xs font-medium text-foreground">
                          {fmtByCurrency(s.balance, s.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {storages.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3">
            <FiCreditCard className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">
              {hasFilter
                ? (lang === "ps" ? "د چاڼ ټول:" : "Filtered total:")
                : (lang === "ps" ? "د نقد ټول ذخیره:" : "Total Cash Holdings:")}
              {" "}
              <span className="font-bold text-primary">
                {fmtCurrency(hasFilter ? filteredTotal : totalBalance, lang)}
              </span>
              {hasFilter && (
                <span className="ms-2 text-xs text-muted-foreground">
                  ({lang === "ps" ? `ټول: ${fmtCurrency(totalBalance, lang)}` : `all: ${fmtCurrency(totalBalance, lang)}`})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {lang === "ps" ? "د ذخیرې ځایونه" : "Storage Locations"}
                <Badge variant="secondary" className="font-mono text-xs">
                  {filtered.length}
                </Badge>
                {hasFilter && filtered.length !== storages.length && (
                  <span className="text-xs text-muted-foreground">
                    {lang === "ps"
                      ? `(ټول ${storages.length} کې)`
                      : `(of ${storages.length} total)`}
                  </span>
                )}
              </CardTitle>
              <Button size="sm" onClick={openCreate}>
                <FiPlus className="mr-1 h-4 w-4" />
                {t("addStorage")}
              </Button>
            </div>

            {/* ── Filter bar ──────────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap items-center gap-2">

              {/* Search — name or storage ID */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`${t("name")} / ID...`}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Storage type filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {lang === "ps" ? "ټول ډولونه" : "All Types"}
                  </SelectItem>
                  {["Bank Account", "Sarafi", "Office Safe", "Treasury"].map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {typeIcons[tp]} {tp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Currency filter */}
              <Select value={currFilter} onValueChange={setCurrFilter}>
                <SelectTrigger className="h-8 w-[100px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {lang === "ps" ? "ټول" : "All"}
                  </SelectItem>
                  <SelectItem value="AFN">AFN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear all */}
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setCurrFilter("all");
                  }}
                >
                  {lang === "ps" ? "پاکول ×" : "Clear ×"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        "ID",
                        t("name"),
                        t("type"),
                        t("currentBalance"),
                        t("currency"),
                        "Last Updated",
                        t("notes"),
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
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                          {hasFilter
                            ? (lang === "ps" ? "کوم ذخیره ونه موندل شوه" : "No storage locations match the current filters")
                            : (lang === "ps" ? "کوم ذخیره نشته" : "No storage locations")}
                        </td>
                      </tr>
                    ) : filtered.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-3 pr-4 ps-4 font-mono text-xs text-muted-foreground">
                          {s.storageId}
                        </td>
                        <td className="py-3 pr-4 text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>{typeIcons[s.type] ?? "💰"}</span>
                            {s.name}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm text-muted-foreground">{s.type}</td>
                        <td className="py-3 pr-4 text-sm font-semibold text-primary">
                          {fmtByCurrency(s.balance, s.currency)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {s.currency}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-muted-foreground">
                          {s.lastUpdated ?? "—"}
                        </td>
                        <td className="py-3 pr-4 max-w-[180px] truncate text-sm text-muted-foreground">
                          {s.notes || "—"}
                        </td>
                        <td className="py-3 pe-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(s)}
                              className="h-8 w-8 p-0"
                              title={t("edit")}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(s.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title={t("delete")}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.item ? t("editStorage") : t("addStorage")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("type")}</FormLabel>
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
                          {[
                            "Bank Account",
                            "Sarafi",
                            "Office Safe",
                            "Treasury",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
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
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("currency")}</FormLabel>
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
                          {["AFN", "USD"].map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("currentBalance")}</FormLabel>
                    <FormControl>
                      <PashtoInput type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <AlertDialogTitle>Delete Storage Location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the storage record.
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
