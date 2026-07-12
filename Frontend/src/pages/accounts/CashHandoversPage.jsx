/**
 * CashHandoversPage — Cash collection & handover management.
 *
 * Roles:
 *  Operator  → submits their own handovers only; sees only their records
 *  Manager / Admin → see ALL handovers; can Confirm or Reject pending ones
 *
 * Features:
 *  • Status tabs: All / Pending / Confirmed / Rejected
 *  • Notification banner: pending count shown to manager/admin
 *  • Submit dialog: shift, cash amount, collection time, notes
 *  • Confirm dialog: choose storage account, records manager name + timestamp
 *  • Reject with optional reason
 *  • On confirm → deposits amount into selected cash storage balance
 *  • Full i18n Pashto / English
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  FiPlus, FiCheckCircle, FiXCircle, FiBell, FiClock, FiDollarSign,
  FiEye, FiSearch, FiFilter,
} from "react-icons/fi";

import { useAppSelector } from "@/components/context/hooks";
import { cashHandoversApi, cashStoragesApi, employeesApi } from "@/services/api";
import StatusBadge from "@/components/features/common/StatusBadge";
import AppLayout from "@/components/features/layouts/AppLayout";
import { useI18n, fmtCurrency, toArabicNum } from "@/components/context/i18n";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import PashtoInput from "@/components/ui/pashto-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ── Submit schema ─────────────────────────────────────────────────────────────
const submitSchema = z.object({
  shiftType:       z.enum(["Morning", "Afternoon", "Evening", "Night"]),
  cashAmount:      z.coerce.number().min(0.01, "Amount must be > 0"),
  collectionTime:  z.string().min(1, "Collection time is required"),
  notes:           z.string().optional(),
});

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ label, count, active, onClick, color }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted"
      }`}>
      {label}
      {count > 0 && (
        <span className={`rounded-full px-1.5 py-px text-xs font-bold ${active ? "bg-primary-foreground/20 text-primary-foreground" : color ?? "bg-muted-foreground/20"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CashHandoversPage() {
  const { user } = useAppSelector((s) => s.auth);
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const isAdmin   = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canManage = isAdmin || isManager;    // can confirm / reject
  const isOperator = user?.role === "operator";

  // ── Local state ─────────────────────────────────────────────────────────
  const [tab,           setTab]           = useState("all");   // all|pending|confirmed|rejected
  const [submitOpen,    setSubmitOpen]    = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null });
  const [storageId,     setStorageId]     = useState("");
  const [rejectDialog,  setRejectDialog]  = useState({ open: false, item: null });
  const [rejectReason,  setRejectReason]  = useState("");
  const [viewDialog,    setViewDialog]    = useState({ open: false, item: null });

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");   // employee name or handover ID
  const [filterEmpId,  setFilterEmpId]  = useState("all"); // admin/manager: filter by employee
  const [filterFrom,   setFilterFrom]   = useState("");
  const [filterTo,     setFilterTo]     = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: handovers = [], isLoading } = useQuery({
    queryKey: ["cashHandovers"],
    queryFn:  cashHandoversApi.getAll,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn:  employeesApi.getAll,
  });
  const { data: storages = [] } = useQuery({
    queryKey: ["cashStorages"],
    queryFn:  cashStoragesApi.getAll,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cashHandovers"] });
    qc.invalidateQueries({ queryKey: ["cashStorages"] });
  };

  // Resolve the logged-in user's employee record
  const myEmployee = employees.find((e) => e.employeeId === user?.employeeId);

  // Manager / admin employee record (to record confirmedBy name)
  const managerEmployee = employees.find((e) => e.employeeId === user?.employeeId);

  const generateId = () =>
    `HND-${String(handovers.length + 1).padStart(3, "0")}`;

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      shiftType:      "Morning",
      cashAmount:     "",
      collectionTime: format(new Date(), "HH:mm"),
      notes:          "",
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  // Submit new handover (any role, own employee record)
  const createMutation = useMutation({
    mutationFn: (data) => cashHandoversApi.create(data),
    onSuccess: () => {
      toast.success(t("handoverAdded"));
      invalidate();
      setSubmitOpen(false);
      form.reset();
    },
    onError: () => toast.error(t("failedSubmit")),
  });

  // Confirm handover → set status + deposit to storage
  const confirmMutation = useMutation({
    mutationFn: async ({ id, sid }) => {
      const now     = format(new Date(), "yyyy-MM-dd HH:mm");
      const handover = handovers.find((h) => h.id === id);
      const storage  = storages.find((s) => s.id === sid);

      // Update handover record
      await cashHandoversApi.patch(id, {
        status:          "confirmed",
        confirmedBy:     managerEmployee?.fullName ?? user?.name ?? "Manager",
        confirmedAt:     now,
        storageId:       sid,
        storageAccount:  storage?.name ?? "",
      });

      // Add cash to storage balance
      if (handover && storage) {
        await cashStoragesApi.patch(storage.id, {
          balance:     storage.balance + handover.cashAmount,
          lastUpdated: format(new Date(), "yyyy-MM-dd"),
        });
      }
    },
    onSuccess: () => {
      toast.success(t("handoverConfirmed"));
      invalidate();
      setConfirmDialog({ open: false, item: null });
      setStorageId("");
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  // Reject handover
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      cashHandoversApi.patch(id, {
        status:      "rejected",
        confirmedBy: managerEmployee?.fullName ?? user?.name ?? "Manager",
        confirmedAt: format(new Date(), "yyyy-MM-dd HH:mm"),
        rejectReason: reason,
      }),
    onSuccess: () => {
      toast.success(t("handoverRejected"));
      invalidate();
      setRejectDialog({ open: false, item: null });
      setRejectReason("");
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  // ── Submit form ───────────────────────────────────────────────────────────
  const onSubmit = (values) => {
    const amount = toArabicNum(values.cashAmount);
    createMutation.mutate({
      handoverId:     generateId(),
      employeeId:     myEmployee?.id ?? "",
      employeeName:   myEmployee?.fullName ?? user?.name ?? "",
      shiftType:      values.shiftType,
      cashAmount:     amount,
      collectionDate: format(new Date(), "yyyy-MM-dd"),
      collectionTime: values.collectionTime,
      date:           format(new Date(), "yyyy-MM-dd"),
      status:         "pending",
      confirmedBy:    "",
      confirmedAt:    "",
      storageId:      "",
      storageAccount: "",
      rejectReason:   "",
      notes:          values.notes ?? "",
    });
  };

  // ── Filtered lists ────────────────────────────────────────────────────────
  // Step 1: scope by role (operator sees only own)
  const roleScoped = isOperator
    ? handovers.filter((h) => h.employeeId === (myEmployee?.id ?? ""))
    : [...handovers].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Step 2: apply search, employee, date filters
  const allVisible = roleScoped.filter((h) => {
    const q = search.toLowerCase().trim();
    if (q) {
      const name = (h.employeeName || empById[h.employeeId]?.fullName || "").toLowerCase();
      const id   = (h.handoverId || "").toLowerCase();
      if (!name.includes(q) && !id.includes(q)) return false;
    }
    if (canManage && filterEmpId !== "all" && h.employeeId !== filterEmpId) return false;
    if (filterFrom && h.date < filterFrom) return false;
    if (filterTo   && h.date > filterTo)   return false;
    return true;
  });

  const tabFiltered =
    tab === "all"
      ? allVisible
      : allVisible.filter((h) => h.status === tab);

  const pendingCount    = allVisible.filter((h) => h.status === "pending").length;
  const confirmedCount  = allVisible.filter((h) => h.status === "confirmed").length;
  const rejectedCount   = allVisible.filter((h) => h.status === "rejected").length;

  const hasActiveFilter = search || (canManage && filterEmpId !== "all") || filterFrom || filterTo;

  const empById     = Object.fromEntries(employees.map((e) => [e.id, e]));
  const storageById = Object.fromEntries(storages.map((s) => [s.id, s]));

  return (
    <AppLayout title={t("handoverList")}>
      <div className="space-y-5">

        {/* ── Pending notification banner (manager/admin only) ─────────────── */}
        {canManage && pendingCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <FiBell className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
              {pendingCount} {lang === "ps"
                ? `پاتې سپارونه د تایید انتظار کوي`
                : `pending handover${pendingCount > 1 ? "s" : ""} awaiting confirmation`}
            </p>
            <Button variant="outline" size="sm" className="ms-auto h-7 border-yellow-500/40 text-xs"
              onClick={() => setTab("pending")}>
              {lang === "ps" ? "کتل" : "Review"}
            </Button>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FiDollarSign className="h-4 w-4 text-primary" />
                {t("handoverList")}
                <Badge variant="secondary" className="font-mono text-xs">{tabFiltered.length}</Badge>
              </CardTitle>
              <Button size="sm" onClick={() => { form.reset({ shiftType: "Morning", cashAmount: "", collectionTime: format(new Date(), "HH:mm"), notes: "" }); setSubmitOpen(true); }}>
                <FiPlus className="mr-1 h-4 w-4" /> {t("submitHandover")}
              </Button>
            </div>

            {/* ── Status tabs ───────────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tab label={t("allHandovers")} count={allVisible.length} active={tab === "all"} onClick={() => setTab("all")} />
              <Tab label={t("pending")}  count={pendingCount}   active={tab === "pending"}
                onClick={() => setTab("pending")}
                color="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" />
              <Tab label={t("confirmed")} count={confirmedCount} active={tab === "confirmed"}
                onClick={() => setTab("confirmed")}
                color="bg-green-500/20 text-green-700 dark:text-green-400" />
              <Tab label={t("rejected")}  count={rejectedCount}  active={tab === "rejected"}
                onClick={() => setTab("rejected")}
                color="bg-destructive/20 text-destructive" />
            </div>

            {/* ── Filters ───────────────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {/* Search */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === "ps" ? "د کارمند نوم یا ID..." : "Employee name or ID..."}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Employee filter — admin/manager only */}
              {canManage && (
                <Select value={filterEmpId} onValueChange={setFilterEmpId}>
                  <SelectTrigger className="h-8 w-[150px] text-sm">
                    <SelectValue placeholder={lang === "ps" ? "کارمند" : "Employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === "ps" ? "ټول کارمندان" : "All Employees"}</SelectItem>
                    {employees.filter((e) => e.status === "active").map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Date from */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">{lang === "ps" ? "له" : "From"}</span>
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 w-36 text-sm" />
              </div>

              {/* Date to */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">{lang === "ps" ? "تر" : "To"}</span>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 w-36 text-sm" />
              </div>

              {/* Clear filters */}
              {hasActiveFilter && (
                <Button variant="ghost" size="sm" className="h-8 self-end text-xs"
                  onClick={() => { setSearch(""); setFilterEmpId("all"); setFilterFrom(""); setFilterTo(""); }}>
                  {lang === "ps" ? "پاکول" : "Clear"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
              </div>
            ) : tabFiltered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {lang === "ps" ? "کوم ریکارډ ونه موندل شو" : "No records found"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        t("handoverId"), t("submittedBy"), t("shift"),
                        t("cashAmount"), t("date"), t("collectionTime"),
                        t("status"), t("confirmedBy"), t("storageAccount"),
                        t("notes"), t("actions"),
                      ].map((h) => (
                        <th key={h}
                          className={`py-2 pr-4 text-xs font-medium text-muted-foreground first:ps-4 ${h === t("actions") ? "text-end" : "text-start"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabFiltered.map((h) => {
                      const emp     = empById[h.employeeId];
                      const storage = storageById[h.storageId];
                      const canAct  = canManage && h.status === "pending";
                      return (
                        <tr key={h.id}
                          className={`border-b border-border transition-colors last:border-0 hover:bg-muted/30 ${h.status === "pending" ? "bg-yellow-500/5" : ""}`}>
                          <td className="py-3 pr-4 ps-4 font-mono text-xs text-muted-foreground">{h.handoverId}</td>
                          <td className="py-3 pr-4 text-sm font-medium">{h.employeeName || emp?.fullName || "—"}</td>
                          <td className="py-3 pr-4 text-sm">{h.shiftType}</td>
                          <td className="py-3 pr-4 text-sm font-semibold">{fmtCurrency(h.cashAmount, lang)}</td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">{h.date}</td>
                          <td className="py-3 pr-4">
                            {h.collectionTime
                              ? <div className="flex items-center gap-1 text-xs text-muted-foreground"><FiClock className="h-3 w-3" />{h.collectionTime}</div>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 pr-4"><StatusBadge status={h.status} /></td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {h.confirmedBy || "—"}
                            {h.confirmedAt && <div className="text-xs text-muted-foreground/60">{h.confirmedAt}</div>}
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {storage?.name || h.storageAccount || "—"}
                          </td>
                          <td className="py-3 pr-4 max-w-[140px] truncate text-sm text-muted-foreground">
                            {h.rejectReason
                              ? <span className="text-destructive">{h.rejectReason}</span>
                              : (h.notes || "—")}
                          </td>
                          <td className="py-3 pe-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              {/* View — all roles */}
                              <Button variant="ghost" size="sm"
                                onClick={() => setViewDialog({ open: true, item: h })}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title={lang === "ps" ? "کتل" : "View"}>
                                <FiEye className="h-3.5 w-3.5" />
                              </Button>
                              {/* Confirm / Reject — manager/admin, pending only */}
                              {canAct && (
                                <>
                                  <Button variant="ghost" size="sm"
                                    onClick={() => { setStorageId(""); setConfirmDialog({ open: true, item: h }); }}
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-400"
                                    title={t("confirmHandover")}>
                                    <FiCheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm"
                                    onClick={() => { setRejectReason(""); setRejectDialog({ open: true, item: h }); }}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    title={t("rejectHandover")}>
                                    <FiXCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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

      {/* ════════════════════════════════════════════════════════════════
          SUBMIT HANDOVER DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("submitHandover")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Shift + Collection Time */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="shiftType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("shift")} <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Morning">{t("morning")}</SelectItem>
                        <SelectItem value="Afternoon">{t("afternoon")}</SelectItem>
                        <SelectItem value="Evening">{t("evening")}</SelectItem>
                        <SelectItem value="Night">{t("night")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="collectionTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("collectionTime")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Cash Amount */}
              <FormField control={form.control} name="cashAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("cashAmount")} <span className="text-destructive">*</span></FormLabel>
                  <FormControl><PashtoInput type="number" step="0.01" min="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notes */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl><Textarea rows={2} placeholder={t("notes")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Submitter info note */}
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {lang === "ps"
                  ? `سپارونکی: ${myEmployee?.fullName ?? user?.name ?? "—"}`
                  : `Submitting as: ${myEmployee?.fullName ?? user?.name ?? "—"}`}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" type="button" onClick={() => setSubmitOpen(false)}>{t("cancel")}</Button>
                <Button type="submit" disabled={createMutation.isPending}>{lang === "ps" ? "ثبت کول" : "Submit"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          CONFIRM DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={confirmDialog.open} onOpenChange={() => setConfirmDialog({ open: false, item: null })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FiCheckCircle className="h-4 w-4 text-green-600" />
              {t("confirmHandover")} — {fmtCurrency(confirmDialog.item?.cashAmount, lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Handover detail summary */}
            {confirmDialog.item && (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("submittedBy")}:</span>
                  <span className="font-medium">{confirmDialog.item.employeeName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("shift")}:</span>
                  <span>{confirmDialog.item.shiftType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("date")}:</span>
                  <span>{confirmDialog.item.date}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">{t("cashAmount")}:</span>
                  <span className="text-green-600 dark:text-green-400">{fmtCurrency(confirmDialog.item.cashAmount, lang)}</span>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {lang === "ps"
                ? "د نقد ذخیرولو ځای وټاکئ:"
                : "Select the cash storage account to deposit into:"}
            </p>

            <Select value={storageId} onValueChange={setStorageId}>
              <SelectTrigger><SelectValue placeholder={t("storageAccount")} /></SelectTrigger>
              <SelectContent>
                {storages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    <span className="ms-1 text-xs text-muted-foreground">({fmtCurrency(s.balance, lang)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Manager name note */}
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {lang === "ps"
                ? `تایید کوونکی: ${managerEmployee?.fullName ?? user?.name ?? "—"}`
                : `Confirming as: ${managerEmployee?.fullName ?? user?.name ?? "—"}`}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDialog({ open: false, item: null })}>{t("cancel")}</Button>
              <Button
                disabled={!storageId || confirmMutation.isPending}
                className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                onClick={() => confirmDialog.item && confirmMutation.mutate({ id: confirmDialog.item.id, sid: storageId })}>
                {t("confirmAndDeposit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          REJECT DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={rejectDialog.open} onOpenChange={() => setRejectDialog({ open: false, item: null })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <FiXCircle className="h-4 w-4" />
              {t("rejectHandover")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {rejectDialog.item && (
              <p className="text-sm text-muted-foreground">
                {lang === "ps"
                  ? `د ${rejectDialog.item.employeeName || "کارمند"} د ${fmtCurrency(rejectDialog.item.cashAmount, lang)} سپارل رد کول`
                  : `Rejecting handover of ${fmtCurrency(rejectDialog.item.cashAmount, lang)} from ${rejectDialog.item.employeeName || "employee"}`}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("rejectReason")}</label>
              <Textarea
                rows={3}
                placeholder={lang === "ps" ? "د رد کولو لامل (اختیاري)" : "Reason for rejection (optional)"}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialog({ open: false, item: null })}>{t("cancel")}</Button>
              <Button variant="destructive" disabled={rejectMutation.isPending}
                onClick={() => rejectDialog.item && rejectMutation.mutate({ id: rejectDialog.item.id, reason: rejectReason })}>
                {t("rejectHandover")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          VIEW DETAIL DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, item: open ? viewDialog.item : null })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FiEye className="h-4 w-4 text-primary" />
              {lang === "ps" ? "د سپارلو تفصیل" : "Handover Detail"}
              {viewDialog.item && (
                <span className="ms-1 font-mono text-sm font-normal text-muted-foreground">
                  {viewDialog.item.handoverId}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewDialog.item && (() => {
            const h       = viewDialog.item;
            const emp     = empById[h.employeeId];
            const storage = storageById[h.storageId];

            // Status color map for the header band
            const statusBand = {
              pending:   "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
              confirmed: "border-green-400 bg-green-50 dark:bg-green-900/20",
              rejected:  "border-destructive bg-destructive/5",
            }[h.status] ?? "border-border bg-muted/30";

            return (
              <div className="space-y-4">

                {/* Status banner */}
                <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${statusBand}`}>
                  <div>
                    <p className="text-xs text-muted-foreground">{lang === "ps" ? "حالت" : "Status"}</p>
                    <StatusBadge status={h.status} className="mt-0.5" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t("cashAmount")}</p>
                    <p className="text-lg font-bold">{fmtCurrency(h.cashAmount, lang)}</p>
                  </div>
                </div>

                {/* Core details grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-4 text-sm">
                  {[
                    { label: t("handoverId"),   value: h.handoverId },
                    { label: t("submittedBy"),  value: h.employeeName || emp?.fullName || "—" },
                    { label: t("shift"),        value: h.shiftType },
                    { label: t("date"),         value: h.date },
                    { label: t("collectionTime"), value: h.collectionTime || "—" },
                    { label: lang === "ps" ? "د جوړولو وخت" : "Submitted At",
                      value: h.collectionDate || h.date || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Confirmation / Rejection section */}
                {(h.confirmedBy || h.rejectReason) && (
                  <div className={`rounded-lg border px-4 py-3 text-sm ${h.status === "rejected" ? "border-destructive/40 bg-destructive/5" : "border-green-400/40 bg-green-50 dark:bg-green-900/20"}`}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {h.status === "rejected"
                        ? (lang === "ps" ? "د رد کولو معلومات" : "Rejection Details")
                        : (lang === "ps" ? "د تایید معلومات" : "Confirmation Details")}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("confirmedBy")}:</span>
                        <span className="font-medium">{h.confirmedBy || "—"}</span>
                      </div>
                      {h.confirmedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{lang === "ps" ? "وخت" : "At"}:</span>
                          <span>{h.confirmedAt}</span>
                        </div>
                      )}
                      {h.status === "confirmed" && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("storageAccount")}:</span>
                          <span className="font-medium">{storage?.name || h.storageAccount || "—"}</span>
                        </div>
                      )}
                      {h.status === "rejected" && h.rejectReason && (
                        <div className="mt-1">
                          <span className="text-muted-foreground">{t("rejectReason")}:</span>
                          <p className="mt-0.5 font-medium text-destructive">{h.rejectReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {h.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t("notes")}</p>
                    <p className="mt-0.5 text-sm">{h.notes}</p>
                  </div>
                )}

                {/* Quick action buttons for pending — manager/admin only */}
                {canManage && h.status === "pending" && (
                  <div className="flex gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                      onClick={() => {
                        setViewDialog({ open: false, item: null });
                        setStorageId("");
                        setConfirmDialog({ open: true, item: h });
                      }}>
                      <FiCheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      {t("confirmHandover")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setViewDialog({ open: false, item: null });
                        setRejectReason("");
                        setRejectDialog({ open: true, item: h });
                      }}>
                      <FiXCircle className="mr-1.5 h-3.5 w-3.5" />
                      {t("rejectHandover")}
                    </Button>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm"
                    onClick={() => setViewDialog({ open: false, item: null })}>
                    {t("close")}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
