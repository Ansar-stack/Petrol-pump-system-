/**
 * FuelTypesPage – Master data for fuel categories.
 *
 * Roles
 *  admin   → full CRUD (add / edit / delete / toggle status)
 *  manager / operator → read-only view
 *
 * Features
 *  • Responsive table with fuel name, selling price, status, created date
 *  • Search by fuel name
 *  • Filter by All / Active / Inactive
 *  • Add / Edit via Dialog (react-hook-form + zod)
 *  • Delete with in-use protection (checks purchases, sales, tanks)
 *  • Duplicate-name validation
 *  • Toast notifications
 *  • Full Pashto / English i18n + RTL support
 */
import { useState, useMemo } from "react";

import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiDroplet,
  FiAlertCircle,
} from "react-icons/fi";

import { fuelTypesApi, purchasesApi, salesApi, tanksApi } from "@/services/api";
import AppLayout from "@/components/features/layouts/AppLayout";
import StatusBadge from "@/components/features/common/StatusBadge";
import { useI18n, fmtCurrency } from "@/components/context/i18n";

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
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

// ── Preset colour swatches ────────────────────────────────────────────────────
const COLOR_SWATCHES = [
  "#22c55e", // green   (Petrol)
  "#f59e0b", // amber   (Diesel)
  "#3b82f6", // blue    (Gas)
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#64748b", // slate
  "#a16207", // brown
];

// ── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Fuel name is required"),
  pricePerLiter: z.coerce
    .number({ invalid_type_error: "Price is required" })
    .positive("Price must be greater than zero"),
  color: z.string().min(1, "Color is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

// ── Summary stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${color ?? "text-foreground"}`}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FuelTypesPage() {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const user = useSelector((s) => s.auth.user);
  const isAdmin = user?.role === "admin";

  // ── Local state ──────────────────────────────────────────────────────────
  const [dialog, setDialog] = useState({ open: false });
  const [deleteId, setDeleteId] = useState(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: fuelTypes = [], isLoading } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: purchasesApi.getAll,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: salesApi.getAll,
  });
  const { data: tanks = [] } = useQuery({
    queryKey: ["tanks"],
    queryFn: tanksApi.getAll,
  });

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      pricePerLiter: "",
      color: COLOR_SWATCHES[0],
      description: "",
      status: "active",
    },
  });

  // ── Filtered / searched list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return fuelTypes.filter((ft) => {
      const matchesSearch = ft.name
        .toLowerCase()
        .includes(search.toLowerCase().trim());
      const matchesStatus =
        statusFilter === "all" || ft.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [fuelTypes, search, statusFilter]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalCount = fuelTypes.length;
  const activeCount = fuelTypes.filter((ft) => ft.status === "active").length;
  const inactiveCount = totalCount - activeCount;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fuelTypes"] });

  const isDuplicateName = (name, excludeId) =>
    fuelTypes.some(
      (ft) =>
        ft.name.toLowerCase() === name.toLowerCase().trim() &&
        ft.id !== excludeId,
    );

  const isInUse = (id) =>
    purchases.some((p) => p.fuelTypeId === id) ||
    sales.some((s) => s.fuelTypeId === id) ||
    tanks.some((tk) => tk.fuelTypeId === id);

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => fuelTypesApi.create(data),
    onSuccess: () => {
      toast.success(t("fuelTypeAdded"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedCreate")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => fuelTypesApi.update(id, data),
    onSuccess: () => {
      toast.success(t("fuelTypeUpdated"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => fuelTypesApi.delete(id),
    onSuccess: () => {
      toast.success(t("fuelTypeDeleted"));
      invalidate();
      setDeleteId(null);
      setDeleteBlocked(false);
    },
    onError: () => toast.error(t("failedDelete")),
  });

  // ── Dialog handlers ──────────────────────────────────────────────────────
  const openCreate = () => {
    form.reset({
      name: "",
      pricePerLiter: "",
      color: COLOR_SWATCHES[0],
      description: "",
      status: "active",
    });
    setDialog({ open: true });
  };

  const openEdit = (item) => {
    form.reset({
      name: item.name,
      pricePerLiter: item.pricePerLiter,
      color: item.color ?? COLOR_SWATCHES[0],
      description: item.description ?? "",
      status: item.status,
    });
    setDialog({ open: true, item });
  };

  const handleDeleteClick = (id) => {
    setDeleteBlocked(isInUse(id));
    setDeleteId(id);
  };

  // ── Form submit ──────────────────────────────────────────────────────────
  const onSubmit = (values) => {
    const trimmedName = values.name.trim();

    if (isDuplicateName(trimmedName, dialog.item?.id)) {
      form.setError("name", { message: t("duplicateFuelName") });
      return;
    }

    const data = {
      name: trimmedName,
      pricePerLiter: values.pricePerLiter,
      color: values.color,
      description: values.description?.trim() ?? "",
      status: values.status,
      createdAt: dialog.item?.createdAt ?? format(new Date(), "yyyy-MM-dd"),
    };

    if (dialog.item) {
      updateMutation.mutate({ id: dialog.item.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout title={t("fuelTypesList")}>
      <div className="space-y-5">
        {/* ── Summary stats ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={t("fuelTypesCount")}
            value={totalCount}
            color="text-foreground"
          />
          <StatCard
            label={t("filterActive")}
            value={activeCount}
            color="text-green-600 dark:text-green-400"
          />
          <StatCard
            label={t("filterInactive")}
            value={inactiveCount}
            color="text-muted-foreground"
          />
        </div>

        {/* ── Main card ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FiDroplet className="h-4 w-4 text-primary" />
                {t("fuelTypesList")}
                <Badge variant="secondary" className="font-mono text-xs">
                  {filtered.length}
                </Badge>
              </CardTitle>

              {/* Add button — admin only */}
              {isAdmin && (
                <Button size="sm" onClick={openCreate}>
                  <FiPlus className="mr-1 h-4 w-4" />
                  {t("addFuelType")}
                </Button>
              )}
            </div>

            {/* ── Search + Filter ──────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="ps-8 h-8 text-sm"
                />
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[130px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")}</SelectItem>
                  <SelectItem value="active">{t("filterActive")}</SelectItem>
                  <SelectItem value="inactive">
                    {t("filterInactive")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Loading skeleton */}
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <FiDroplet className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  {search || statusFilter !== "all"
                    ? t("noData")
                    : t("fuelTypesList")}
                </p>
              </div>
            ) : (
              /* Table */
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        t("fuelName"),
                        t("sellingPrice"),
                        t("description"),
                        t("status"),
                        t("createdDate"),
                        ...(isAdmin ? [t("actions")] : []),
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
                    {filtered.map((ft) => (
                      <tr
                        key={ft.id}
                        className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                      >
                        {/* Fuel name + colour dot */}
                        <td className="py-3 pr-4 ps-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border"
                              style={{ background: ft.color ?? "#94a3b8" }}
                            />
                            <span className="text-sm font-medium">
                              {ft.name}
                            </span>
                          </div>
                        </td>

                        {/* Selling price */}
                        <td className="py-3 pr-4 text-sm font-semibold text-primary">
                          {fmtCurrency(ft.pricePerLiter, lang, 2)}
                          <span className="ms-0.5 text-xs font-normal text-muted-foreground">
                            /L
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3 pr-4 max-w-[200px] truncate text-sm text-muted-foreground">
                          {ft.description || "—"}
                        </td>

                        {/* Status badge */}
                        <td className="py-3 pr-4">
                          <StatusBadge status={ft.status} />
                        </td>

                        {/* Created date */}
                        <td className="py-3 pr-4 text-sm text-muted-foreground">
                          {ft.createdAt ?? "—"}
                        </td>

                        {/* Actions — admin only */}
                        {isAdmin && (
                          <td className="py-3 pe-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(ft)}
                                className="h-8 w-8 p-0"
                                title={t("edit")}
                              >
                                <FiEdit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(ft.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title={t("delete")}
                              >
                                <FiTrash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.item ? t("editFuelType") : t("addFuelType")}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Fuel Name + Color marker */}
              <div className="flex gap-3 items-start">
                {/* Color picker */}
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem className="shrink-0">
                      <FormLabel>{t("color")}</FormLabel>
                      <FormControl>
                        {/* Hidden native color input drives the value;
                            the visible swatch shows the current pick */}
                        <div className="relative">
                          <input
                            type="color"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label={t("color")}
                          />
                          <div
                            className="h-9 w-14 rounded-md border border-border shadow-sm transition-all hover:scale-105"
                            style={{ background: field.value }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fuel Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>
                        {t("fuelName")}{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t("fuelName")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Quick colour swatches */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => field.onChange(c)}
                          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                          style={{
                            background: c,
                            borderColor:
                              field.value === c ? "white" : "transparent",
                            boxShadow:
                              field.value === c
                                ? `0 0 0 2px ${c}`
                                : undefined,
                          }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              {/* Selling Price + Status */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pricePerLiter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("sellingPrice")}{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <PashtoInput
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("status")}</FormLabel>
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
                          <SelectItem value="active">
                            {t("filterActive")}
                          </SelectItem>
                          <SelectItem value="inactive">
                            {t("filterInactive")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder={t("description")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price note */}
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {lang === "ps"
                  ? "د پلور بیه به د راتلونکو معاملو لپاره اوتوماتیک کارول کیږي."
                  : "The selling price will be automatically applied to all future sales transactions."}
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDialog({ open: false })}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {dialog.item ? t("update") : t("add")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteBlocked(false);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteBlocked && (
                <FiAlertCircle className="h-5 w-5 text-destructive" />
              )}
              {deleteBlocked ? t("cannotDeleteInUse") : t("areYouSure")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked
                ? lang === "ps"
                  ? "دا د تیلو ډول د پیرودنو، پلور، یا ټانکونو سره تړلی دی. لومړی هغه ریکارډونه لرې کړئ."
                  : "This fuel type is linked to existing purchases, sales, or tanks. Remove those records first before deleting."
                : t("deleteConfirmMsg")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            {!deleteBlocked && (
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("delete")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
