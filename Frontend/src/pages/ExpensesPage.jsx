import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import toast from "react-hot-toast";

import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiHome, FiWifi, FiTool, FiTruck, FiMonitor, FiShield, FiPackage, FiMoreHorizontal, FiZap } from "react-icons/fi";

import { format } from "date-fns";

import { useAppSelector } from "@/components/context/hooks";

import { expensesApi } from "@/services/api";

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

const EXPENSE_TYPE_KEYS = [
  "Electricity",
  "Salaries",
  "Rent",
  "Internet",
  "Internet & Phone",
  "Maintenance",
  "Transport",
  "IT / Software",
  "Security",
  "Office Supplies",
  "Other",
];

// ── Icon + colour per expense type ────────────────────────────────────────────
const TYPE_META = {
  "Electricity":     { icon: FiZap,             color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  "Salaries":        { icon: FiUsers,            color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-100 dark:bg-blue-900/30" },
  "Rent":            { icon: FiHome,             color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  "Internet":        { icon: FiWifi,             color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  "Internet & Phone":{ icon: FiWifi,             color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  "Maintenance":     { icon: FiTool,             color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  "Transport":       { icon: FiTruck,            color: "text-green-600 dark:text-green-400",  bg: "bg-green-100 dark:bg-green-900/30" },
  "IT / Software":   { icon: FiMonitor,          color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  "Security":        { icon: FiShield,           color: "text-red-600 dark:text-red-400",      bg: "bg-red-100 dark:bg-red-900/30" },
  "Office Supplies": { icon: FiPackage,          color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-100 dark:bg-teal-900/30" },
  "Other":           { icon: FiMoreHorizontal,   color: "text-muted-foreground",               bg: "bg-muted" },
};

function getTypeMeta(type) {
  return TYPE_META[type] ?? { icon: FiMoreHorizontal, color: "text-muted-foreground", bg: "bg-muted" };
}

const schema = z.object({
  type: z.string().min(1, "Type is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
});

export default function ExpensesPage() {
  const { user } = useAppSelector((s) => s.auth);
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false });
  const [deleteId, setDeleteId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: expensesApi.getAll,
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["expenses"] });
  const generateId = () =>
    `EXP-${String(expenses.length + 1).padStart(3, "0")}`;

  const createMutation = useMutation({
    mutationFn: (d) => expensesApi.create(d),
    onSuccess: () => {
      toast.success(t("expenseAdded"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedCreate")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => expensesApi.update(id, data),
    onSuccess: () => {
      toast.success(t("expenseUpdated"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedUpdate")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => expensesApi.delete(id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      invalidate();
      setDeleteId(null);
    },
    onError: () => toast.error(t("failedDelete")),
  });

  const openCreate = () => {
    form.reset({
      type: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
    });
    setDialog({ open: true });
  };
  const openEdit = (item) => {
    form.reset({
      type: item.type,
      amount: item.amount,
      date: item.date,
      description: item.description,
    });
    setDialog({ open: true, item });
  };

  const onSubmit = (values) => {
    const amount = toArabicNum(values.amount);
    const data = {
      expenseId: dialog.item?.expenseId ?? generateId(),
      type: values.type,
      amount,
      date: values.date,
      description: values.description ?? "",
      addedBy: user?.role ?? "admin",
    };
    if (dialog.item) updateMutation.mutate({ id: dialog.item.id, data });
    else createMutation.mutate(data);
  };

  const filtered = expenses.filter((e) => {
    const typeMatch = filterType === "all" || e.type === filterType;
    const monthMatch = !filterMonth || e.date.startsWith(filterMonth);
    return typeMatch && monthMatch;
  });

  const totalFiltered = filtered.reduce((a, e) => a + e.amount, 0);
  const byType = EXPENSE_TYPE_KEYS.map((etype) => ({
    type: etype,
    total: expenses
      .filter((e) => e.type === etype)
      .reduce((a, e) => a + e.amount, 0),
  })).filter((t) => t.total > 0);

  const canEdit = user?.role === "admin" || user?.role === "manager";

  return (
    <AppLayout title={t("expenseList")}>
      <div className="space-y-6">
        {/* Summary by type */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {byType.slice(0, 4).map((item) => {
            const meta = getTypeMeta(item.type);
            const Icon = meta.icon;
            return (
              <Card key={item.type} className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                      <p className="mt-1 text-xl font-bold text-foreground">
                        {fmtCurrency(item.total, lang)}
                      </p>
                    </div>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Expense Records</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {filtered.length}
                  </span>{" "}
                  records • Total:{" "}
                  <span className="font-semibold text-foreground">
                    {fmtCurrency(totalFiltered, lang)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="h-8 w-36"
                />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {EXPENSE_TYPE_KEYS.map((ek) => (
                      <SelectItem key={ek} value={ek}>
                        {ek}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canEdit && (
                  <Button size="sm" onClick={openCreate}>
                    <FiPlus className="mr-1 h-4 w-4" /> Add Expense
                  </Button>
                )}
              </div>
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
                        t("expenseId"),
                        t("type"),
                        t("amount"),
                        t("date"),
                        t("description"),
                        t("actions"),
                      ].map((h) => (
                        <th
                          key={h}
                          className={`py-2 pr-4 text-xs font-medium text-muted-foreground ${h === "Actions" ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {[...filtered]
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )
                      .map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                            {e.expenseId}
                          </td>
                          <td className="py-3 pr-4">
                            {(() => {
                              const meta = getTypeMeta(e.type);
                              const Icon = meta.icon;
                              return (
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}>
                                  <Icon className="h-3 w-3 shrink-0" />
                                  {e.type}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 pr-4 text-sm font-semibold text-destructive">
                            {fmtCurrency(e.amount, lang)}
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {e.date}
                          </td>
                          <td className="max-w-[200px] truncate py-3 pr-4 text-sm text-muted-foreground">
                            {e.description || "—"}
                          </td>
                          <td className="py-3 text-right">
                            {canEdit && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(e)}
                                  className="h-8 w-8 p-0"
                                >
                                  <FiEdit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteId(e.id)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <FiTrash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          No expenses found
                        </td>
                      </tr>
                    )}
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
              {dialog.item ? t("editExpense") : t("addExpense")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("expenseType")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectType")} />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        {EXPENSE_TYPE_KEYS.map((ek) => {
                          const meta = getTypeMeta(ek);
                          const Icon = meta.icon;
                          return (
                            <SelectItem key={ek} value={ek}>
                              <div className="flex items-center gap-2">
                                <span className={`flex h-5 w-5 items-center justify-center rounded ${meta.bg}`}>
                                  <Icon className={`h-3 w-3 ${meta.color}`} />
                                </span>
                                {ek}
                              </div>
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
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("description")}</FormLabel>
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
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this expense record.
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
