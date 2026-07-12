/**
 * EmployeesPage — Full CRUD with login-account integration.
 * Admin: create / edit / delete.  Manager: view-only.  Operator: access denied.
 * Every new employee gets a matching db.users record so they can log in.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiSearch } from "react-icons/fi";
import { format } from "date-fns";
import { useAppSelector } from "@/components/context/hooks";
import { employeesApi, usersApi } from "@/services/api";
import StatusBadge from "@/components/features/common/StatusBadge";
import AppLayout from "@/components/features/layouts/AppLayout";
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
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import PashtoInput from "@/components/ui/pashto-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Schemas ───────────────────────────────────────────────────────────────────
const commonFields = {
  fullName:  z.string().min(1, "Name is required"),
  email:     z.string().min(1, "Email is required").email("Enter a valid email"),
  phone:     z.string().min(1, "Phone is required"),
  idNumber:  z.string().min(1, "ID number is required"),
  position:  z.string().min(1, "Position is required"),
  salary:    z.coerce.number().min(1, "Salary must be > 0"),
  hireDate:  z.string().min(1, "Hire date is required"),
  role:      z.enum(["admin", "manager", "operator"]),
  status:    z.enum(["active", "inactive", "suspended"]),
};

const createSchema = z.object({
  ...commonFields,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const editSchema = z.object({
  ...commonFields,
  // On edit: empty = keep existing; non-empty = must be ≥6 chars
  password: z.union([
    z.string().length(0),
    z.string().min(6, "Password must be at least 6 characters"),
  ]),
});

// ── Access Denied ─────────────────────────────────────────────────────────────
function AccessDenied({ t }) {
  return (
    <AppLayout title={t("employeeList")}>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <FiTrash2 className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You do not have permission to access this page.
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user } = useAppSelector((s) => s.auth);
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [dialog, setDialog]       = useState({ open: false });
  const [deleteId, setDeleteId]   = useState(null);
  const [showPassword, setShowPw] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");   // name / ID / email / position
  const [roleFilter,   setRoleFilter]   = useState("all"); // all | admin | manager | operator
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive | suspended
  const [hireFrom,     setHireFrom]     = useState("");
  const [hireTo,       setHireTo]       = useState("");

  const isAdmin   = user?.role === "admin";
  const isManager = user?.role === "manager";

  // Managers see the page read-only; operators get access denied
  if (!isAdmin && !isManager) return <AccessDenied t={t} />;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: employeesApi.getAll,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  const generateEmpId = () =>
    `E${String(employees.length + 1).padStart(3, "0")}`;

  // Email uniqueness: allow the same employee's own email when editing
  const isDuplicateEmail = (email, currentEmpId) =>
    users.some(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase().trim() &&
        u.employeeId !== currentEmpId,
    );

  // ── Form ──────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(dialog.item ? editSchema : createSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      idNumber: "",
      position: "",
      salary: 2500,
      hireDate: format(new Date(), "yyyy-MM-dd"),
      role: "operator",
      status: "active",
      password: "",
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const emp = await employeesApi.create(payload.employee);
      await usersApi.create(payload.user);
      return emp;
    },
    onSuccess: () => {
      toast.success(t("employeeAdded"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedCreate")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, empData, userData }) => {
      const emp = await employeesApi.update(id, empData);
      await usersApi.updateByEmployeeId(empData.employeeId, userData);
      return emp;
    },
    onSuccess: () => {
      toast.success(t("employeeUpdated"));
      invalidate();
      setDialog({ open: false });
    },
    onError: () => toast.error(t("failedUpdate")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const emp = employees.find((e) => e.id === id);
      if (!emp) throw new Error("Employee not found");
      await usersApi.deleteByEmployeeId(emp.employeeId);
      return employeesApi.delete(id);
    },
    onSuccess: () => {
      toast.success(t("employeeDeleted"));
      invalidate();
      setDeleteId(null);
    },
    onError: () => toast.error(t("failedDelete")),
  });

  // ── Dialog handlers ───────────────────────────────────────────────────────
  const openCreate = () => {
    form.clearErrors();
    form.reset({
      fullName: "", email: "", phone: "", idNumber: "", position: "",
      salary: 2500, hireDate: format(new Date(), "yyyy-MM-dd"),
      role: "operator", status: "active", password: "",
    });
    setShowPw(false);
    setDialog({ open: true });
  };

  const openEdit = (item) => {
    const linkedUser = users.find((u) => u.employeeId === item.employeeId);
    form.clearErrors();
    form.reset({
      fullName: item.fullName,
      email: linkedUser?.email ?? "",
      phone: item.phone,
      idNumber: item.idNumber,
      position: item.position,
      salary: item.salary,
      hireDate: item.hireDate,
      role: item.role,
      status: item.status,
      password: "",  // always empty on edit
    });
    setShowPw(false);
    setDialog({ open: true, item });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = (values) => {
    const email = values.email.trim().toLowerCase();
    const empId = dialog.item?.employeeId;

    if (isDuplicateEmail(email, empId)) {
      form.setError("email", { message: t("duplicateEmail") });
      return;
    }

    const salary = toArabicNum(values.salary);
    const employeeId = empId ?? generateEmpId();

    const empData = {
      employeeId,
      fullName:  values.fullName.trim(),
      phone:     values.phone.trim(),
      idNumber:  values.idNumber.trim(),
      position:  values.position.trim(),
      salary,
      hireDate:  values.hireDate,
      role:      values.role,
      status:    values.status,
    };

    if (dialog.item) {
      // Edit: only update password if provided
      const userData = {
        email,
        role: values.role,
        name: values.fullName.trim(),
        ...(values.password.trim() ? { password: values.password } : {}),
      };
      updateMutation.mutate({ id: dialog.item.id, empData, userData });
    } else {
      // Create: write employee + user together
      const userData = {
        username:   email.split("@")[0],
        email,
        password:   values.password,
        role:       values.role,
        name:       values.fullName.trim(),
        employeeId,
      };
      createMutation.mutate({ employee: empData, user: userData });
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return employees.filter((e) => {
      const linkedUser = users.find((u) => u.employeeId === e.employeeId);
      if (q &&
          !e.fullName.toLowerCase().includes(q) &&
          !e.employeeId.toLowerCase().includes(q) &&
          !(linkedUser?.email ?? "").toLowerCase().includes(q) &&
          !e.position.toLowerCase().includes(q)) return false;
      if (roleFilter   !== "all" && e.role   !== roleFilter)   return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (hireFrom && e.hireDate < hireFrom) return false;
      if (hireTo   && e.hireDate > hireTo)   return false;
      return true;
    });
  }, [employees, users, search, roleFilter, statusFilter, hireFrom, hireTo]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const activeCount    = employees.filter((e) => e.status === "active").length;
  const totalSalary    = filtered.reduce((s, e) => s + (e.salary ?? 0), 0);
  const hasFilter      = search || roleFilter !== "all" || statusFilter !== "all" || hireFrom || hireTo;

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title={t("employeeList")}>
      <div className="space-y-4">

        {/* ── Summary stat cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "ټول کارمندان" : "Total Employees"}
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{employees.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t("active")}</p>
              <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "چاڼ شوي" : "Filtered"}
              </p>
              <p className="mt-1 text-xl font-bold text-primary">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {lang === "ps" ? "د چاڼ معاش" : "Filtered Salary"}
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{fmtCurrency(totalSalary, lang)}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Main table card ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {t("employeeList")}
                <Badge variant="secondary" className="font-mono text-xs">
                  {filtered.length}
                </Badge>
              </CardTitle>
              {isAdmin && (
                <Button size="sm" onClick={openCreate}>
                  <FiPlus className="mr-1 h-4 w-4" />
                  {t("addEmployee")}
                </Button>
              )}
            </div>

            {/* ── Filter bar ───────────────────────────────────────────── */}
            <div className="mt-3 flex flex-wrap items-end gap-2">

              {/* Search — name, ID, email, position */}
              <div className="relative min-w-[160px] flex-1">
                <FiSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={`${t("fullName")} / ID / ${t("email")}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 ps-8 text-sm"
                />
              </div>

              {/* Role filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-8 w-[130px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {lang === "ps" ? "ټول رولونه" : "All Roles"}
                  </SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="operator">Pump Operator</SelectItem>
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
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {/* Hire date from */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {lang === "ps" ? "د استخدام له" : "Hired from"}
                </span>
                <Input
                  type="date"
                  value={hireFrom}
                  onChange={(e) => setHireFrom(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>

              {/* Hire date to */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {lang === "ps" ? "تر" : "to"}
                </span>
                <Input
                  type="date"
                  value={hireTo}
                  onChange={(e) => setHireTo(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>

              {/* Clear all */}
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 self-end text-xs"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                    setHireFrom("");
                    setHireTo("");
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
                {lang === "ps" ? "کوم کارمند ونه موندل شو" : "No employees match the current filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        "ID", t("fullName"), t("email"), t("phone"),
                        t("position"), "Role", t("salary"), t("hireDate"), t("status"),
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
                    {filtered.map((emp) => {
                      const linkedUser = users.find((u) => u.employeeId === emp.employeeId);
                      return (
                        <tr
                          key={emp.id}
                          className={`border-b border-border transition-colors last:border-0 hover:bg-muted/30 ${
                            emp.status === "suspended" ? "bg-amber-500/5" : ""
                          }`}
                        >
                          <td className="py-3 pr-4 ps-4 font-mono text-xs text-muted-foreground">
                            {emp.employeeId}
                          </td>
                          <td className="py-3 pr-4 text-sm font-medium">{emp.fullName}</td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">
                            {linkedUser?.email ?? "—"}
                          </td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">{emp.phone}</td>
                          <td className="py-3 pr-4 text-sm">{emp.position}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              emp.role === "admin"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                : emp.role === "manager"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-primary/10 text-primary"
                            }`}>
                              {emp.role}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-sm">{fmtCurrency(emp.salary, lang)}</td>
                          <td className="py-3 pr-4 text-sm text-muted-foreground">{emp.hireDate}</td>
                          <td className="py-3 pr-4"><StatusBadge status={emp.status} /></td>
                          {isAdmin && (
                            <td className="py-3 pe-3 text-end">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => openEdit(emp)}
                                  className="h-8 w-8 p-0"
                                  title={t("edit")}
                                >
                                  <FiEdit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => setDeleteId(emp.id)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title={t("delete")}
                                >
                                  <FiTrash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
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

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.item ? t("editEmployee") : t("addEmployee")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Row 1 — Full Name + Email */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fullName")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder={t("fullName")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="email" placeholder="employee@ppms.com" {...field} /></FormControl>
                    <FormMessage />
                    <FormDescription className="text-xs">
                      {lang === "ps" ? "د ننوتلو لپاره کارول کیږي" : "Used for login"}
                    </FormDescription>
                  </FormItem>
                )} />
              </div>

              {/* Row 2 — Password + Phone */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("passwordLabel")}
                      {!dialog.item && <span className="text-destructive"> *</span>}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder={dialog.item ? "Leave blank to keep unchanged" : "Min. 6 characters"}
                          {...field}
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    {dialog.item && (
                      <FormDescription className="text-xs">
                        {lang === "ps" ? "خالي پریږدئ که بدلون نه غواړئ" : "Leave blank to keep current password"}
                      </FormDescription>
                    )}
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="0501234567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Row 3 — ID Number + Position */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="idNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("idNumber")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="ID001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("position")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder={t("position")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Row 4 — Salary + Hire Date */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="salary" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("salaryLabel")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><PashtoInput type="number" step="1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="hireDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("hireDate")} <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Row 5 — Role + Status */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("type")} <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="operator">Pump Operator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <FormDescription className="text-xs">
                      {lang === "ps" ? "د سیسټم لاسرسي ټاکي" : "Determines system access level"}
                    </FormDescription>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("status")} <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">{t("active")}</SelectItem>
                        <SelectItem value="inactive">{t("inactive")}</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Info note */}
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {lang === "ps"
                  ? "کارمند به د بریښنالیک او پټنوم سره سیسټم ته ننوتلی شي."
                  : "The employee will be able to log in using their email and password immediately after creation."}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" type="button" onClick={() => setDialog({ open: false })}>
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

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ps"
                ? "دا کارمند او د هغه د ننوتلو حساب دواړه حذف کیږي. دا کار بیرته نه شي کیدی."
                : "This will permanently remove the employee and their login account. This action cannot be undone."}
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
