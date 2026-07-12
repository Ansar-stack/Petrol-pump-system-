/**
 * CustomersPage — Full customer management module.
 *
 * Features:
 *  • Register credit & cash customers (Admin/Manager)
 *  • Customer table with search + filter (All / Credit / Cash / Status)
 *  • Status badges: active / inactive / blocked
 *  • Status change: Admin & Manager only — Operator sees read-only view
 *  • Record payment against a customer's credit balance
 *  • Payment history drawer per customer
 *  • Account Statement dialog (credit activity + payments)
 *  • Delete protection: cannot delete customer with existing sales
 *  • Summary stat cards: total / credit / blocked / outstanding balance
 *  • Full Pashto / English i18n + RTL support
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiDollarSign,
  FiFileText, FiAlertTriangle, FiAlertCircle, FiClock, FiUsers,
} from "react-icons/fi";

import { useAppSelector } from "@/components/context/hooks";
import { customersApi, customerPaymentsApi, salesApi } from "@/services/api";
import AppLayout from "@/components/features/layouts/AppLayout";
import StatusBadge from "@/components/features/common/StatusBadge";
import { useI18n, fmtCurrency, toArabicNum } from "@/components/context/i18n";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// ── Zod schemas ───────────────────────────────────────────────────────────────
const customerSchema = z.object({
  fullName:    z.string().min(1, "Full name is required"),
  phone:       z.string().min(1, "Phone is required"),
  idNumber:    z.string().optional(),
  type:        z.enum(["credit", "cash"]),
  creditLimit: z.coerce.number().min(0),
  status:      z.enum(["active", "inactive", "blocked"]),
  notes:       z.string().optional(),
});

const paymentSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Amount is required" })
    .positive("Amount must be > 0"),
  date:   z.string().min(1, "Date is required"),
  method: z.enum(["cash", "card", "bank_transfer"]),
  notes:  z.string().optional(),
});

// ── Small helpers ─────────────────────────────────────────────────────────────
function generateCustomerId(customers) {
  return `C${String(customers.length + 1).padStart(3, "0")}`;
}

function generatePaymentId(payments) {
  return `CPAY-${String(payments.length + 1).padStart(3, "0")}`;
}

/** A single summary stat card */
function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-0.5 text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg ?? "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${color ?? "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Colour-coded credit usage bar */
function CreditBar({ balance, limit }) {
  if (!limit || limit === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.min(Math.round((balance / limit) * 100), 100);
  const overLimit = balance > limit;
  const color = overLimit
    ? "bg-destructive"
    : pct >= 80
    ? "bg-amber-500"
    : "bg-primary";
  return (
    <div className="w-28">
      <div className="mb-0.5 flex justify-between text-xs">
        <span className={overLimit ? "font-semibold text-destructive" : ""}>{pct}%</span>
        {overLimit && <FiAlertTriangle className="h-3 w-3 text-destructive" />}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { user }   = useAppSelector((s) => s.auth);
  const { t, lang } = useI18n();
  const qc          = useQueryClient();

  const isAdmin   = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canWrite  = isAdmin || isManager;  // can create / edit / delete / pay
  const canChangeStatus = isAdmin || isManager; // spec: only manager+admin

  // ── Local state ─────────────────────────────────────────────────────────
  const [formDialog,      setFormDialog]      = useState({ open: false });
  const [payDialog,       setPayDialog]       = useState({ open: false, customer: null });
  const [historyDialog,   setHistoryDialog]   = useState({ open: false, customer: null });
  const [statementDialog, setStatementDialog] = useState({ open: false, customer: null });
  const [deleteId,        setDeleteId]        = useState(null);
  const [deleteBlocked,   setDeleteBlocked]   = useState(false);
  const [search,          setSearch]          = useState("");
  const [typeFilter,      setTypeFilter]      = useState("all");   // all | credit | cash
  const [statusFilter,    setStatusFilter]    = useState("all");   // all | active | inactive | blocked
  const [overLimitOnly,   setOverLimitOnly]   = useState(false);   // show only over-credit-limit

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.getAll,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["customerPayments"],
    queryFn: customerPaymentsApi.getAll,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: salesApi.getAll,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["customerPayments"] });
  };

  // ── Customer form ────────────────────────────────────────────────────────
  const customerForm = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: "", phone: "", idNumber: "", type: "credit",
      creditLimit: 5000, status: "active", notes: "",
    },
  });

  // ── Payment form ─────────────────────────────────────────────────────────
  const payForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "", date: format(new Date(), "yyyy-MM-dd"),
      method: "cash", notes: "",
    },
  });

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers.filter((c) => {
      const isOverLimit = c.type === "credit" && c.creditLimit > 0 && c.creditBalance > c.creditLimit;
      const matchSearch =
        c.fullName.toLowerCase().includes(q) ||
        c.customerId?.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.idNumber ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q);
      const matchType      = typeFilter    === "all" || c.type   === typeFilter;
      const matchStatus    = statusFilter  === "all" || c.status === statusFilter;
      const matchOverLimit = !overLimitOnly || isOverLimit;
      return matchSearch && matchType && matchStatus && matchOverLimit;
    });
  }, [customers, search, typeFilter, statusFilter, overLimitOnly]);

  const overLimitCount = customers.filter(
    (c) => c.type === "credit" && c.creditLimit > 0 && c.creditBalance > c.creditLimit
  ).length;

  const hasFilter = search || typeFilter !== "all" || statusFilter !== "all" || overLimitOnly;

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalCount    = customers.length;
  const creditCount   = customers.filter((c) => c.type === "credit").length;
  const blockedCount  = customers.filter((c) => c.status === "blocked").length;
  const totalOutstanding = customers
    .filter((c) => c.type === "credit")
    .reduce((sum, c) => sum + (c.creditBalance ?? 0), 0);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const paymentsFor = (customerId) =>
    payments
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

  const salesFor = (customerId) =>
    sales.filter((s) => s.customerId === customerId);

  const isCustomerInUse = (id) =>
    sales.some((s) => s.customerId === id);

  // ── Mutations ─────────────────────────────────────────────────────────────

  // Create customer
  const createMutation = useMutation({
    mutationFn: (data) => customersApi.create(data),
    onSuccess: () => {
      toast.success(t("customerAdded"));
      invalidate();
      setFormDialog({ open: false });
    },
    onError: () => toast.error(t("failedCreate")),
  });

  // Edit customer
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => customersApi.update(id, data),
    onSuccess: () => {
      toast.success(t("customerUpdated"));
      invalidate();
      setFormDialog({ open: false });
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  // Status-only patch (used by status change button)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => customersApi.patch(id, { status }),
    onSuccess: () => {
      toast.success(t("customerUpdated"));
      invalidate();
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  // Delete customer
  const deleteMutation = useMutation({
    mutationFn: (id) => customersApi.delete(id),
    onSuccess: () => {
      toast.success(t("customerDeleted"));
      invalidate();
      setDeleteId(null);
    },
    onError: () => toast.error(t("failedDelete")),
  });

  // Record payment — reduces creditBalance, creates payment record
  const payMutation = useMutation({
    mutationFn: async ({ customer, values }) => {
      const amount = toArabicNum(values.amount);
      // Create payment record
      await customerPaymentsApi.create({
        paymentId:  generatePaymentId(payments),
        customerId: customer.id,
        amount,
        date:       values.date,
        method:     values.method,
        notes:      values.notes ?? "",
      });
      // Reduce customer credit balance
      const newBalance = Math.max(0, (customer.creditBalance ?? 0) - amount);
      return customersApi.patch(customer.id, { creditBalance: newBalance });
    },
    onSuccess: () => {
      toast.success(t("paymentAdded"));
      invalidate();
      setPayDialog({ open: false, customer: null });
    },
    onError: () => toast.error(t("failedRecord")),
  });

  // Delete a single payment record — restores credit balance
  const deletePaymentMutation = useMutation({
    mutationFn: async ({ payment, customer }) => {
      await customerPaymentsApi.delete(payment.id);
      // Restore the balance
      const restoredBalance = (customer.creditBalance ?? 0) + (payment.amount ?? 0);
      return customersApi.patch(customer.id, { creditBalance: restoredBalance });
    },
    onSuccess: () => {
      toast.success(t("paymentDeleted"));
      invalidate();
    },
    onError: () => toast.error(t("failedDelete")),
  });

  // ── Form handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    customerForm.reset({
      fullName: "", phone: "", idNumber: "", type: "credit",
      creditLimit: 5000, status: "active", notes: "",
    });
    setFormDialog({ open: true });
  };

  const openEdit = (c) => {
    customerForm.reset({
      fullName:    c.fullName,
      phone:       c.phone,
      idNumber:    c.idNumber ?? "",
      type:        c.type,
      creditLimit: c.creditLimit ?? 0,
      status:      c.status,
      notes:       c.notes ?? "",
    });
    setFormDialog({ open: true, item: c });
  };

  const onCustomerSubmit = (values) => {
    const customerId = formDialog.item?.customerId ?? generateCustomerId(customers);
    const data = {
      customerId,
      fullName:    values.fullName.trim(),
      phone:       values.phone.trim(),
      idNumber:    values.idNumber?.trim() ?? "",
      type:        values.type,
      creditLimit: values.type === "credit" ? values.creditLimit : 0,
      creditBalance: formDialog.item?.creditBalance ?? 0,
      status:      values.status,
      notes:       values.notes?.trim() ?? "",
    };
    if (formDialog.item) {
      updateMutation.mutate({ id: formDialog.item.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openPayDialog = (c) => {
    payForm.reset({
      amount: "", date: format(new Date(), "yyyy-MM-dd"),
      method: "cash", notes: "",
    });
    setPayDialog({ open: true, customer: c });
  };

  const onPaySubmit = (values) => {
    payMutation.mutate({ customer: payDialog.customer, values });
  };

  const handleDeleteClick = (id) => {
    setDeleteBlocked(isCustomerInUse(id));
    setDeleteId(id);
  };

  const watchedType = customerForm.watch("type");
  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title={t("customerList")}>
      <div className="space-y-5">

        {/* ── Summary stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={FiUsers}       label={t("customerList")}   value={totalCount}
            color="text-foreground" bg="bg-muted" />
          <StatCard icon={FiClock}       label={t("creditOnly")}     value={creditCount}
            color="text-blue-600 dark:text-blue-400" bg="bg-blue-100 dark:bg-blue-900/30" />
          <StatCard icon={FiAlertCircle} label={t("blocked")}        value={blockedCount}
            color="text-destructive" bg="bg-destructive/10" />
          <StatCard icon={FiDollarSign}  label={t("outstandingCredit")}
            value={fmtCurrency(totalOutstanding, lang)}
            color="text-amber-600 dark:text-amber-400" bg="bg-amber-100 dark:bg-amber-900/30" />
        </div>
        {/* ── Main table card ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {t("customerList")}
                <Badge variant="secondary" className="font-mono text-xs">{filtered.length}</Badge>
              </CardTitle>
              {canWrite && (
                <Button size="sm" onClick={openCreate}>
                  <FiPlus className="mr-1 h-4 w-4" /> {t("addCustomer")}
                </Button>
              )}
            </div>

            {/* ── Filter bar ──────────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap items-center gap-2">

              {/* Search — name, ID, phone, notes */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`${t("fullName")} / ID / ${t("phone")}...`}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Customer type */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[130px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCustomers")}</SelectItem>
                  <SelectItem value="credit">{t("creditOnly")}</SelectItem>
                  <SelectItem value="cash">{t("cashOnly")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[120px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")}</SelectItem>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="inactive">{t("inactive")}</SelectItem>
                  <SelectItem value="blocked">{t("blocked")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Over-limit quick toggle */}
              <button
                type="button"
                onClick={() => setOverLimitOnly((v) => !v)}
                className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                  overLimitOnly
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <FiAlertTriangle className="h-3.5 w-3.5" />
                {lang === "ps" ? "حد تیر شوي" : "Over Limit"}
                {overLimitCount > 0 && !overLimitOnly && (
                  <span className="ml-0.5 rounded-full bg-destructive/20 px-1.5 py-px text-[10px] font-bold text-destructive">
                    {overLimitCount}
                  </span>
                )}
              </button>

              {/* Clear all */}
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setOverLimitOnly(false);
                  }}
                >
                  {lang === "ps" ? "پاکول ×" : "Clear ×"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1,2,3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <FiUsers className="h-8 w-8 opacity-30" />
                <p className="text-sm">{t("noData")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        t("customerId"), t("fullName"), t("phone"),
                        t("type"), t("creditBalance"), t("creditLimit"),
                        "Usage", t("status"), t("actions"),
                      ].map((h) => (
                        <th key={h}
                          className={`py-2 pr-4 text-xs font-medium text-muted-foreground first:ps-4 ${h === t("actions") ? "text-end" : "text-start"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const isBlocked  = c.status === "blocked";
                      const isInactive = c.status === "inactive";
                      const isOverLimit = c.type === "credit" && c.creditLimit > 0 && c.creditBalance > c.creditLimit;
                      return (
                        <tr key={c.id}
                          className={`border-b border-border transition-colors last:border-0 hover:bg-muted/30 ${isBlocked ? "bg-destructive/5" : ""}`}>
                          <td className="py-3 pr-4 ps-4 font-mono text-xs text-muted-foreground">{c.customerId}</td>
                          <td className="py-3 pr-4">
                            <div>
                              <p className="text-sm font-medium">{c.fullName}</p>
                              {c.notes && <p className="max-w-[160px] truncate text-xs text-muted-foreground">{c.notes}</p>}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">{c.phone || "—"}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${c.type === "credit" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                              {c.type}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1">
                              <span className={`text-sm font-semibold ${isOverLimit ? "text-destructive" : "text-foreground"}`}>
                                {c.type === "credit" ? fmtCurrency(c.creditBalance ?? 0, lang) : "—"}
                              </span>
                              {isOverLimit && <FiAlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {c.type === "credit" ? fmtCurrency(c.creditLimit ?? 0, lang) : "—"}
                          </td>
                          <td className="py-3 pr-4">
                            {c.type === "credit"
                              ? <CreditBar balance={c.creditBalance ?? 0} limit={c.creditLimit ?? 0} />
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={c.status} />
                              {isBlocked  && <span className="text-xs text-destructive">{t("blocked")}</span>}
                              {isInactive && <span className="text-xs text-amber-600">{t("inactive")}</span>}
                            </div>
                          </td>
                          <td className="py-3 pe-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              {/* Account statement */}
                              <Button variant="ghost" size="sm" onClick={() => setStatementDialog({ open: true, customer: c })}
                                className="h-8 w-8 p-0" title={t("accountStatement")}>
                                <FiFileText className="h-3.5 w-3.5" />
                              </Button>
                              {/* Payment history */}
                              <Button variant="ghost" size="sm" onClick={() => setHistoryDialog({ open: true, customer: c })}
                                className="h-8 w-8 p-0" title={t("paymentHistory")}>
                                <FiClock className="h-3.5 w-3.5" />
                              </Button>
                              {/* Record payment — credit customers only, Admin/Manager */}
                              {canWrite && c.type === "credit" && (
                                <Button variant="ghost" size="sm" onClick={() => openPayDialog(c)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-600" title={t("recordPaymentFor")}>
                                  <FiDollarSign className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {/* Edit */}
                              {canWrite && (
                                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}
                                  className="h-8 w-8 p-0" title={t("edit")}>
                                  <FiEdit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {/* Delete */}
                              {canWrite && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(c.id)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("delete")}>
                                  <FiTrash2 className="h-3.5 w-3.5" />
                                </Button>
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
          ADD / EDIT CUSTOMER DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={formDialog.open} onOpenChange={(open) => setFormDialog({ open })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formDialog.item ? t("editCustomer") : t("addCustomer")}</DialogTitle>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-4">

              {/* Full Name + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={customerForm.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fullName")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder={t("fullName")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={customerForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="0501234567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ID Number + Type */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={customerForm.control} name="idNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("idNumber")}</FormLabel>
                    <FormControl><Input placeholder="ID001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={customerForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("type")} <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="credit">{t("credit")}</SelectItem>
                        <SelectItem value="cash">{t("cash")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Credit Limit — shown only for credit type */}
              {watchedType === "credit" && (
                <FormField control={customerForm.control} name="creditLimit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("creditLimitLabel")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><PashtoInput type="number" step="1" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Status — only Manager/Admin can set */}
              <FormField control={customerForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("status")}
                    {!canChangeStatus && (
                      <span className="ms-1 text-xs text-muted-foreground">({t("readOnly")})</span>
                    )}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canChangeStatus}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t("active")}</SelectItem>
                      <SelectItem value="inactive">{t("inactive")}</SelectItem>
                      <SelectItem value="blocked">{t("blocked")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {!canChangeStatus && (
                    <p className="text-xs text-amber-600">{t("statusChangeNote")}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notes */}
              <FormField control={customerForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl><Textarea rows={2} placeholder={t("notes")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" type="button" onClick={() => setFormDialog({ open: false })}>{t("cancel")}</Button>
                <Button type="submit" disabled={isPending}>{formDialog.item ? t("update") : t("add")}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          RECORD PAYMENT DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={payDialog.open} onOpenChange={(open) => setPayDialog({ open, customer: open ? payDialog.customer : null })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("recordPaymentFor")}
              {payDialog.customer && (
                <span className="ms-2 text-sm font-normal text-muted-foreground">
                  — {payDialog.customer.fullName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Customer status warnings */}
          {payDialog.customer?.status === "blocked" && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              {t("blockedWarning")}
            </div>
          )}
          {payDialog.customer?.status === "inactive" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <FiAlertTriangle className="h-4 w-4 shrink-0" />
              {t("inactiveWarning")}
            </div>
          )}

          {/* Outstanding balance summary */}
          {payDialog.customer && (
            <div className="rounded-lg bg-muted px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("outstanding")}:</span>
                <span className="font-bold text-foreground">
                  {fmtCurrency(payDialog.customer.creditBalance ?? 0, lang)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("creditLimit")}:</span>
                <span>{fmtCurrency(payDialog.customer.creditLimit ?? 0, lang)}</span>
              </div>
            </div>
          )}

          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4">
              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={payForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("paymentAmount")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><PashtoInput type="number" step="0.01" min="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={payForm.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("paymentDate")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Method */}
              <FormField control={payForm.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("paymentMethod")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="cash">{t("cash")}</SelectItem>
                      <SelectItem value="card">{t("card")}</SelectItem>
                      <SelectItem value="bank_transfer">{t("bankTransfer")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notes */}
              <FormField control={payForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl><Textarea rows={2} placeholder={t("notes")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" type="button" onClick={() => setPayDialog({ open: false, customer: null })}>{t("cancel")}</Button>
                <Button type="submit" disabled={payMutation.isPending}>{t("recordPayment")}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          PAYMENT HISTORY DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={historyDialog.open} onOpenChange={(open) => setHistoryDialog({ open, customer: open ? historyDialog.customer : null })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("paymentHistory")}
              {historyDialog.customer && (
                <span className="ms-2 text-sm font-normal text-muted-foreground">
                  — {historyDialog.customer.fullName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {historyDialog.customer && (() => {
            const cPays = paymentsFor(historyDialog.customer.id);
            const totalPaid = cPays.reduce((s, p) => s + (p.amount ?? 0), 0);
            return (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex flex-wrap gap-4 rounded-lg bg-muted px-4 py-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("totalPaid")}</p>
                    <p className="font-bold text-green-600 dark:text-green-400">{fmtCurrency(totalPaid, lang)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("outstanding")}</p>
                    <p className="font-bold text-foreground">{fmtCurrency(historyDialog.customer.creditBalance ?? 0, lang)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("creditLimit")}</p>
                    <p className="font-bold">{fmtCurrency(historyDialog.customer.creditLimit ?? 0, lang)}</p>
                  </div>
                </div>

                {/* Payment rows */}
                {cPays.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("noPaymentsYet")}</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-2 pr-3 text-start">ID</th>
                          <th className="py-2 pr-3 text-start">{t("paymentDate")}</th>
                          <th className="py-2 pr-3 text-start">{t("amount")}</th>
                          <th className="py-2 pr-3 text-start">{t("method")}</th>
                          <th className="py-2 text-start">{t("notes")}</th>
                          {canWrite && <th className="py-2 text-end"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {cPays.map((p) => (
                          <tr key={p.id} className="border-b border-border last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{p.paymentId}</td>
                            <td className="py-2 pr-3">{p.date}</td>
                            <td className="py-2 pr-3 font-semibold text-green-600 dark:text-green-400">
                              {fmtCurrency(p.amount, lang)}
                            </td>
                            <td className="py-2 pr-3 capitalize text-muted-foreground">{p.method?.replace("_", " ")}</td>
                            <td className="py-2 max-w-[120px] truncate text-muted-foreground">{p.notes || "—"}</td>
                            {canWrite && (
                              <td className="py-2 text-end">
                                <Button variant="ghost" size="sm"
                                  onClick={() => deletePaymentMutation.mutate({ payment: p, customer: historyDialog.customer })}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                  <FiTrash2 className="h-3 w-3" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          ACCOUNT STATEMENT DIALOG
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={statementDialog.open} onOpenChange={(open) => setStatementDialog({ open, customer: open ? statementDialog.customer : null })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FiFileText className="h-4 w-4" />
              {t("accountStatement")}
              {statementDialog.customer && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {statementDialog.customer.fullName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {statementDialog.customer && (() => {
            const c        = statementDialog.customer;
            const cPays    = paymentsFor(c.id);
            const cSales   = salesFor(c.id);
            const totalPaid = cPays.reduce((s, p)   => s + (p.amount ?? 0), 0);
            const totalDebt = cSales.reduce((s, sa) => s + (sa.totalAmount ?? 0), 0);

            // Build unified timeline: credit charges + payments, newest first
            const timeline = [
              ...cSales.map((s) => ({
                id:     `sale-${s.id}`,
                date:   s.date,
                type:   "charge",
                label:  `${lang === "ps" ? "پلور" : "Sale"} ${s.transactionId}`,
                amount: s.totalAmount ?? 0,
              })),
              ...cPays.map((p) => ({
                id:     `pay-${p.id}`,
                date:   p.date,
                type:   "payment",
                label:  `${lang === "ps" ? "تادیه" : "Payment"} ${p.paymentId}`,
                amount: p.amount ?? 0,
              })),
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            return (
              <div className="space-y-4">
                {/* Customer info header */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("customerId")}</p>
                    <p className="font-mono font-semibold">{c.customerId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("status")}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("creditLimit")}</p>
                    <p className="font-semibold">{fmtCurrency(c.creditLimit ?? 0, lang)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("outstanding")}</p>
                    <p className={`font-bold ${(c.creditBalance ?? 0) > (c.creditLimit ?? 0) ? "text-destructive" : "text-foreground"}`}>
                      {fmtCurrency(c.creditBalance ?? 0, lang)}
                    </p>
                  </div>
                </div>

                {/* Totals summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t("totalCredit"),  value: fmtCurrency(totalDebt,   lang), color: "text-destructive" },
                    { label: t("totalPaid"),    value: fmtCurrency(totalPaid,   lang), color: "text-green-600 dark:text-green-400" },
                    { label: t("outstanding"),  value: fmtCurrency(c.creditBalance ?? 0, lang), color: "text-foreground font-bold" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-muted px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-sm font-semibold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Blocked / inactive warning */}
                {c.status === "blocked" && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <FiAlertCircle className="h-4 w-4 shrink-0" /> {t("blockedWarning")}
                  </div>
                )}
                {c.status === "inactive" && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <FiAlertTriangle className="h-4 w-4 shrink-0" /> {t("inactiveWarning")}
                  </div>
                )}

                {/* Quick status change — Manager/Admin only */}
                {canChangeStatus && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">{lang === "ps" ? "حالت بدل کړئ:" : "Change status:"}</span>
                    {["active","inactive","blocked"].filter((s) => s !== c.status).map((s) => (
                      <Button key={s} variant="outline" size="sm"
                        className={`h-7 text-xs capitalize ${s === "blocked" ? "border-destructive/50 text-destructive hover:bg-destructive/10" : s === "inactive" ? "border-amber-400/50 text-amber-700 hover:bg-amber-50" : "border-green-400/50 text-green-700 hover:bg-green-50"}`}
                        onClick={() => statusMutation.mutate({ id: c.id, status: s })}>
                        → {t(s)}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                {timeline.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-2 ps-3 pr-3 text-start">{t("date")}</th>
                          <th className="py-2 pr-3 text-start">{lang === "ps" ? "ډول" : "Type"}</th>
                          <th className="py-2 pr-3 text-start">{t("description")}</th>
                          <th className="py-2 pe-3 text-end">{t("amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="py-2 ps-3 pr-3 text-xs text-muted-foreground">
                              {row.date ? (row.date.length > 10 ? format(new Date(row.date), "yyyy-MM-dd") : row.date) : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${row.type === "payment" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                {row.type === "payment" ? (lang === "ps" ? "تادیه" : "Payment") : (lang === "ps" ? "قرض" : "Credit")}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">{row.label}</td>
                            <td className={`py-2 pe-3 text-end font-semibold ${row.type === "payment" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                              {row.type === "payment" ? "+" : "–"}{fmtCurrency(row.amount, lang)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION
      ════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleteBlocked(false); } }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteBlocked && <FiAlertCircle className="h-5 w-5 text-destructive" />}
              {deleteBlocked ? t("cannotDeleteHasSales") : t("areYouSure")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked
                ? (lang === "ps"
                  ? "دا پیرودونکی د پلور ریکارډونو سره تړلی دی. لومړی هغه ریکارډونه لرې کړئ."
                  : "This customer is linked to existing sales records. Remove those records first.")
                : t("deleteConfirmMsg")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            {!deleteBlocked && (
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("delete")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
