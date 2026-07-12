import { useState, useMemo } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import toast from "react-hot-toast";

import { FiPlus, FiEdit2, FiTrash2, FiAlertTriangle, FiSearch } from "react-icons/fi";

import { tanksApi, fuelTypesApi } from "@/services/api";

import StatusBadge from "@/components/features/common/StatusBadge";
import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n } from "@/components/context/i18n";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  fuelTypeId: z.string().min(1, "Fuel required"),
  capacity: z.coerce.number().min(1, "Capacity must be > 0"),
  currentStock: z.coerce.number().min(0),
  minimumLevel: z.coerce.number().min(0),
  status: z.enum(["active", "inactive", "maintenance"]),
  location: z.string().optional(),
});

export default function TanksPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [dialog, setDialog]   = useState({ open: false });
  const [deleteId, setDeleteId] = useState(null);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [fuelFilter,   setFuelFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: tanks = [], isLoading } = useQuery({
    queryKey: ["tanks"],
    queryFn: tanksApi.getAll,
  });
  const { data: fuelTypes = [] } = useQuery({
    queryKey: ["fuelTypes"],
    queryFn: fuelTypesApi.getAll,
  });

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      fuelTypeId: "",
      capacity: 10000,
      currentStock: 0,
      minimumLevel: 500,
      status: "active",
      location: "",
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tanks"] });

  const createMutation = useMutation({
    mutationFn: (d) => tanksApi.create(d),
    onSuccess: () => { toast.success(t("tankAdded")); invalidate(); setDialog({ open: false }); },
    onError: () => toast.error(t("failedCreate")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => tanksApi.update(id, data),
    onSuccess: () => { toast.success(t("tankUpdated")); invalidate(); setDialog({ open: false }); },
    onError: () => toast.error(t("failedUpdate")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => tanksApi.delete(id),
    onSuccess: () => { toast.success(t("tankDeleted")); invalidate(); setDeleteId(null); },
    onError: () => toast.error(t("failedDelete")),
  });

  // ── Dialog handlers ───────────────────────────────────────────────────────
  const openCreate = () => {
    form.reset({ name: "", fuelTypeId: "", capacity: 10000, currentStock: 0, minimumLevel: 500, status: "active", location: "" });
    setDialog({ open: true });
  };

  const openEdit = (item) => {
    form.reset({
      name: item.name, fuelTypeId: item.fuelTypeId,
      capacity: item.capacity, currentStock: item.currentStock,
      minimumLevel: item.minimumLevel, status: item.status, location: item.location,
    });
    setDialog({ open: true, item });
  };

  const onSubmit = (values) => {
    const data = { ...values, location: values.location ?? "" };
    if (dialog.item) updateMutation.mutate({ id: dialog.item.id, data });
    else createMutation.mutate(data);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tanks.filter((tank) => {
      const ft    = fuelTypes.find((f) => f.id === tank.fuelTypeId);
      const isLow = tank.currentStock < tank.minimumLevel;

      if (q) {
        const haystack = `${tank.name} ${tank.location ?? ""} ${ft?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (fuelFilter   !== "all" && tank.fuelTypeId !== fuelFilter)   return false;
      if (statusFilter !== "all" && tank.status     !== statusFilter)  return false;
      if (lowStockOnly && !isLow) return false;
      return true;
    });
  }, [tanks, fuelTypes, search, fuelFilter, statusFilter, lowStockOnly]);

  const lowStockCount = tanks.filter((tk) => tk.currentStock < tk.minimumLevel).length;
  const hasFilter = search || fuelFilter !== "all" || statusFilter !== "all" || lowStockOnly;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title={t("tankList")}>
      <Card>
        <CardHeader className="pb-3">
          {/* ── Title row ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {t("tankList")}
              <Badge variant="secondary" className="font-mono text-xs">
                {filtered.length}
              </Badge>
              {lowStockCount > 0 && !lowStockOnly && (
                <Badge
                  variant="destructive"
                  className="cursor-pointer text-xs"
                  onClick={() => setLowStockOnly(true)}
                >
                  <FiAlertTriangle className="mr-1 h-3 w-3" />
                  {lowStockCount} low
                </Badge>
              )}
            </CardTitle>
            <Button size="sm" onClick={openCreate}>
              <FiPlus className="mr-1 h-4 w-4" /> {t("addTank")}
            </Button>
          </div>

          {/* ── Filter bar ────────────────────────────────────────────── */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Search — name, location, fuel type */}
            <div className="relative min-w-[160px] flex-1">
              <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
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

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterAll")}</SelectItem>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="inactive">{t("inactive")}</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>

            {/* Low-stock toggle */}
            <button
              type="button"
              onClick={() => setLowStockOnly((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                lowStockOnly
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <FiAlertTriangle className="h-3.5 w-3.5" />
              Low Stock
            </button>

            {/* Clear all */}
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSearch("");
                  setFuelFilter("all");
                  setStatusFilter("all");
                  setLowStockOnly(false);
                }}
              >
                {t("cancel")} ×
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No tanks match the current filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      t("name"),
                      "Fuel Type",
                      t("capacity"),
                      "Stock Level",
                      "Min. Level",
                      t("status"),
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
                  {filtered.map((tank) => {
                    const ft    = fuelTypes.find((f) => f.id === tank.fuelTypeId);
                    const pct   = Math.round((tank.currentStock / tank.capacity) * 100);
                    const isLow = tank.currentStock < tank.minimumLevel;
                    return (
                      <tr
                        key={tank.id}
                        className={`border-b border-border transition-colors last:border-0 hover:bg-muted/30 ${
                          isLow ? "bg-destructive/5" : ""
                        }`}
                      >
                        {/* Name + location */}
                        <td className="py-3 pr-4 ps-4">
                          <p className="text-sm font-medium">{tank.name}</p>
                          {tank.location && (
                            <p className="text-xs text-muted-foreground">{tank.location}</p>
                          )}
                        </td>

                        {/* Fuel type with colour dot */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: ft?.color ?? "#94a3b8" }}
                            />
                            <span className="text-sm">{ft?.name ?? "Unknown"}</span>
                          </div>
                        </td>

                        {/* Capacity */}
                        <td className="py-3 pr-4 text-sm">
                          {tank.capacity.toLocaleString()}L
                        </td>

                        {/* Stock level with progress bar */}
                        <td className="min-w-[140px] py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {isLow && (
                              <FiAlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex justify-between text-xs">
                                <span className={isLow ? "font-medium text-destructive" : ""}>
                                  {tank.currentStock.toLocaleString()}L
                                </span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </div>
                              <Progress
                                value={pct}
                                className={`h-1.5 ${isLow ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Min level */}
                        <td className="py-3 pr-4 text-sm text-muted-foreground">
                          {tank.minimumLevel.toLocaleString()}L
                        </td>

                        {/* Status */}
                        <td className="py-3 pr-4">
                          <StatusBadge status={tank.status} />
                        </td>

                        {/* Actions */}
                        <td className="py-3 pe-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(tank)}
                              className="h-8 w-8 p-0"
                              title={t("edit")}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(tank.id)}
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

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.item ? t("editTank") : t("addTank")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name")}</FormLabel>
                    <FormControl><Input placeholder={t("name")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fuelTypeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={t("selectFuel")} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fuelTypes.map((ft) => (
                          <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("capacityL")}</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currentStock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("currentStockL")}</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="minimumLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("minLevelL")}</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("location")}</FormLabel>
                    <FormControl><Input placeholder={t("location")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("status")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">{t("active")}</SelectItem>
                        <SelectItem value="inactive">{t("inactive")}</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setDialog({ open: false })}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {dialog.item ? t("update") : t("add")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tank?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the tank record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
