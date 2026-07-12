import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import toast from "react-hot-toast";

import {
  FiDroplet,
  FiEye,
  FiEyeOff,
  FiLogIn,
  FiKey,
  FiArrowLeft,
  FiShield,
  FiMail,
} from "react-icons/fi";

import { loginSuccess } from "@/components/context/authSlice";
import { useAppDispatch } from "@/components/context/hooks";

import { authApi } from "@/services/api";
import { useI18n } from "@/components/context/i18n";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

// ── Schemas ──────────────────────────────────────────────────
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const step1Schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});
const step2Schema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
});
const step3Schema = z
  .object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "passwordsMismatch",
    path: ["confirmPassword"],
  });

// ── Step dots ─────────────────────────────────────────────────
function dotWidth(i, current) {
  if (i < current) return "w-6 bg-primary";
  if (i === current) return "w-4 bg-primary";
  return "w-2 bg-muted";
}

function StepDots({ current, total }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- positional step indicator, never reorders
          key={i}
          className={`h-2 rounded-full transition-all ${dotWidth(i, current)}`}
        />
      ))}
    </div>
  );
}

// ── Forgot Password Dialog ────────────────────────────────────
function ForgotPasswordDialog({ open, onClose }) {
  const [step, setStep] = useState(1);
  const { t } = useI18n();
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const step1 = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: "" },
  });
  const step2 = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { employeeId: "" },
  });
  const step3 = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const handleClose = () => {
    setStep(1);
    setFoundUser(null);
    step1.reset();
    step2.reset();
    step3.reset();
    onClose();
  };

  const onStep1 = async (values) => {
    setLoading(true);
    try {
      const users = await authApi.findByEmail(values.email.toLowerCase());
      if (!users || users.length === 0) {
        step1.setError("email", { message: "invalidCredentials" });
        return;
      }
      if (users[0].role !== "admin") {
        step1.setError("email", { message: "invalidCredentials" });
        return;
      }
      setFoundUser(users[0]);
      setStep(2);
    } catch {
      toast.error(t("connectionError"));
    } finally {
      setLoading(false);
    }
  };

  const onStep2 = (values) => {
    if (!foundUser) return;
    if (
      values.employeeId.trim().toUpperCase() !==
      foundUser.employeeId.toUpperCase()
    ) {
      step2.setError("employeeId", { message: "invalidCredentials" });
      return;
    }
    setStep(3);
  };

  const onStep3 = async (values) => {
    if (!foundUser) return;
    setLoading(true);
    try {
      await authApi.resetPassword(foundUser.id, values.newPassword);
      toast.success(t("signIn"));
      handleClose();
    } catch {
      toast.error(t("failedSubmit"));
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    t("verifyAccount"),
    t("confirmIdentity"),
    t("setNewPassword"),
  ];
  const StepIcons = [FiMail, FiShield, FiKey];
  const StepIcon = StepIcons[step - 1];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <StepIcon className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-balance text-center">
              {stepTitles[step - 1]}
            </DialogTitle>
          </div>
        </DialogHeader>

        <StepDots current={step - 1} total={3} />

        {/* Step 1 — Email */}
        {step === 1 && (
          <Form {...step1}>
            <form onSubmit={step1.handleSubmit(onStep1)} className="space-y-4">
              <p className="text-pretty text-center text-sm text-muted-foreground">
                {t("loginSubtitle")}
              </p>
              <FormField
                control={step1.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailAddress")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@ppms.com"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    {t("loading")}
                  </span>
                ) : (
                  t("signIn")
                )}
              </Button>
            </form>
          </Form>
        )}

        {/* Step 2 — Employee ID */}
        {step === 2 && (
          <Form {...step2}>
            <form onSubmit={step2.handleSubmit(onStep2)} className="space-y-4">
              <p className="text-pretty text-center text-sm text-muted-foreground">
                Enter your{" "}
                <span className="font-medium text-foreground">Employee ID</span>{" "}
                to verify your identity.
              </p>
              <FormField
                control={step2.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("employeeId")}</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. E001" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  <FiArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  Verify
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Step 3 — New Password */}
        {step === 3 && (
          <Form {...step3}>
            <form onSubmit={step3.handleSubmit(onStep3)} className="space-y-4">
              <p className="text-pretty text-center text-sm text-muted-foreground">
                Choose a strong new password for{" "}
                <span className="font-medium text-foreground">
                  {foundUser?.name}
                </span>
                .
              </p>
              <FormField
                control={step3.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("newPassword")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNewPw ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showNewPw ? (
                            <FiEyeOff className="h-4 w-4" />
                          ) : (
                            <FiEye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step3.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("confirmPassword")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPw ? "text" : "password"}
                          placeholder={t("confirmPassword")}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showConfirmPw ? (
                            <FiEyeOff className="h-4 w-4" />
                          ) : (
                            <FiEye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                >
                  <FiArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      Saving...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Login Page ────────────────────────────────────────────────
export default function LoginPage() {
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const users = await authApi.login(
        values.email.toLowerCase(),
        values.password,
      );
      if (users && users.length > 0) {
        dispatch(loginSuccess(users[0]));
        toast.success(`${t("signIn")} — ${users[0].name}`);
        navigate("/dashboard");
      } else {
        form.setError("email", { message: t("invalidCredentials") });
      }
    } catch {
      toast.error(t("connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <FiDroplet className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-balance text-2xl font-bold text-foreground">
            {t("loginTitle")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("loginSubtitle")}</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <p className="text-center text-sm text-muted-foreground">
              Demo:{" "}
              <span className="font-medium text-foreground">
                admin@ppms.com / admin123
              </span>
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("emailAddress")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("emailAddress")}
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t("password")}</FormLabel>
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                        >
                          {t("forgotPassword")}
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={t("password")}
                            autoComplete="current-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {showPassword ? (
                              <FiEyeOff className="h-4 w-4" />
                            ) : (
                              <FiEye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      {t("loading")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FiLogIn className="h-4 w-4" />
                      {t("signIn")}
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="font-semibold text-foreground">Admin</p>
            <p>admin@ppms.com</p>
            <p>admin123</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="font-semibold text-foreground">Manager</p>
            <p>manager@ppms.com</p>
            <p>manager123</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="font-semibold text-foreground">Operator</p>
            <p>operator@ppms.com</p>
            <p>op123</p>
          </div>
        </div>
      </div>

      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  );
}
