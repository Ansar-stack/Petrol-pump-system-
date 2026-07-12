import { useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import { clsx } from "clsx";
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiChevronDown,
  FiChevronRight,
  FiCreditCard,
  FiDroplet,
  FiFileText,
  FiGlobe,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiShoppingCart,
  FiSun,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { MdReceiptLong } from "react-icons/md";

import { logout } from "@/components/context/authSlice";
import { useAppDispatch, useAppSelector } from "@/components/context/hooks";
import { useI18n } from "@/components/context/i18n";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Nav items (keys resolved via t() at render time) ────────────────────────
function useNavItems() {
  const { t } = useI18n();
  return [
    { labelKey: "dashboard", path: "/dashboard", icon: FiGrid },
    {
      labelKey: "fuelManagement",
      icon: FiDroplet,
      children: [
        { labelKey: "fuelTypes", path: "/fuel/types" },
        { labelKey: "tanks", path: "/fuel/tanks" },
        { labelKey: "purchases", path: "/fuel/purchases" },
      ],
      roles: ["admin", "manager"],
    },
    { labelKey: "fuelSales", path: "/sales", icon: FiShoppingCart },
    {
      labelKey: "employeeSales",
      path: "/employee-sales",
      icon: FiBarChart2,
    },
    {
      labelKey: "employees",
      path: "/employees",
      icon: FiUsers,
      roles: ["admin", "manager"],
    },
    { labelKey: "customers", path: "/customers", icon: FiUserCheck },
    // Cash handovers: operators submit; managers/admins also have full accounts menu
    {
      labelKey: "cashHandovers",
      path: "/accounts/handovers",
      icon: FiCreditCard,
      roles: ["operator"],
    },
    {
      labelKey: "accountsCash",
      icon: FiCreditCard,
      roles: ["admin", "manager"],
      children: [
        { labelKey: "accountsPayable", path: "/accounts/payable" },
        { labelKey: "cashHandovers",   path: "/accounts/handovers" },
        { labelKey: "cashStorage",     path: "/accounts/storage" },
      ],
    },
    {
      labelKey: "profitLoss",
      path: "/profit-loss",
      icon: FiTrendingUp,
      roles: ["admin", "manager"],
    },
    {
      labelKey: "expenses",
      path: "/expenses",
      icon: MdReceiptLong,
      roles: ["admin", "manager"],
    },
    {
      labelKey: "lossManagement",
      path: "/losses",
      icon: FiAlertTriangle,
      roles: ["admin", "manager"],
    },
    {
      labelKey: "reports",
      path: "/reports",
      icon: FiFileText,
      roles: ["admin", "manager"],
    },
  ].map((item) => ({
    ...item,
    label: t(item.labelKey),
    children: item.children?.map((c) => ({ ...c, label: t(c.labelKey) })),
  }));
}

// ─── Language selector dropdown ───────────────────────────────────────────────
function LangSelector({ compact = false }) {
  const { lang, switchLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={clsx(
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            compact ? "w-9 px-0" : "flex-1",
          )}
          title={t("language")}
        >
          <FiGlobe className="h-4 w-4 shrink-0" />
          {!compact && (
            <span className="ms-2 text-xs">
              {lang === "ps" ? "پښتو" : "EN"}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem
          onClick={() => switchLang("ps")}
          className={clsx("gap-2 font-medium", lang === "ps" && "text-primary")}
        >
          <span className="text-base leading-none">🇦🇫</span>
          {t("pashto")}
          {lang === "ps" && <span className="ms-auto text-primary">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => switchLang("en")}
          className={clsx("gap-2 font-medium", lang === "en" && "text-primary")}
        >
          <span className="text-base leading-none">🇬🇧</span>
          {t("english")}
          {lang === "en" && <span className="ms-auto text-primary">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Sidebar navigation ───────────────────────────────────────────────────────
function SidebarNav({ onClose }) {
  const location = useLocation();
  const { user } = useAppSelector((s) => s.auth);
  const navItems = useNavItems();

  const [expanded, setExpanded] = useState(() => {
    // Keep parent groups open by default
    return navItems.filter((i) => i.children).map((i) => i.labelKey);
  });

  const toggle = (key) =>
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((l) => l !== key) : [...prev, key],
    );

  const isActive = (path) => path === location.pathname;
  const isParentActive = (item) =>
    item.children?.some((c) => c.path === location.pathname) ?? false;
  const allowed = (item) =>
    !item.roles || item.roles.includes(user?.role ?? "");

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.filter(allowed).map((item) => {
        if (item.children) {
          const isOpen = expanded.includes(item.labelKey);
          const parentActive = isParentActive(item);
          return (
            <div key={item.labelKey}>
              <button
                onClick={() => toggle(item.labelKey)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  parentActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {isOpen ? (
                  <FiChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <FiChevronRight className="h-3 w-3 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="ms-7 mt-1 flex flex-col gap-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      to={child.path}
                      onClick={onClose}
                      className={clsx(
                        "rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive(child.path)
                          ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <Link
            key={item.path}
            to={item.path ?? ""}
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(item.path)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ─── Main layout ────────────────────────────────────────────────────────────
export default function AppLayout({ children, title }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const { user } = useAppSelector((s) => s.auth);
  const { t, lang, switchLang } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setDarkMode(isDark);
  };

  const roleBadgeColor = {
    admin: "bg-primary text-primary-foreground",
    manager: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    operator: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  }[user?.role ?? "operator"];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <FiActivity className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground">
              {t("appName")}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {t("appSubtitle")}
            </p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <SidebarNav />
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute start-0 top-0 flex h-full w-72 flex-col overflow-y-auto scroll-smooth bg-sidebar">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <div className="flex items-center gap-2">
                <FiActivity className="h-5 w-5 text-sidebar-primary" />
                <span className="text-sm font-bold text-sidebar-foreground">
                  {t("appName")}
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-sidebar-foreground"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <SidebarNav onClose={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden h-screen">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
          {/* Mobile hamburger */}
          <button
            className="rounded-md p-1.5 transition-colors hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <FiMenu className="h-5 w-5" />
          </button>

          {/* Page title */}
          <h1 className="min-w-0 flex-1 truncate text-balance text-base font-semibold text-foreground">
            {title}
          </h1>

          {/* Header actions */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Notification bell */}
            <Button variant="ghost" size="sm" className="relative p-2">
              <FiBell className="h-4 w-4" />
              <Badge className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center bg-destructive p-0 text-xs text-destructive-foreground">
                3
              </Badge>
            </Button>

            {/* Language selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 px-2 text-foreground hover:bg-muted"
                  title={t("language")}
                >
                  <FiGlobe className="h-4 w-4" />
                  <span className="hidden text-xs font-medium md:inline">
                    {lang === "ps" ? "پښتو" : "EN"}
                  </span>
                  <FiChevronDown className="hidden h-3 w-3 md:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[130px]">
                <DropdownMenuItem
                  onClick={() => switchLang("ps")}
                  className={clsx(
                    "gap-2 font-medium",
                    lang === "ps" && "text-primary",
                  )}
                >
                  <span className="text-base leading-none">🇦🇫</span>
                  {t("pashto")}
                  {lang === "ps" && (
                    <span className="ms-auto text-primary">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => switchLang("en")}
                  className={clsx(
                    "gap-2 font-medium",
                    lang === "en" && "text-primary",
                  )}
                >
                  <span className="text-base leading-none">🇬🇧</span>
                  {t("english")}
                  {lang === "en" && (
                    <span className="ms-auto text-primary">✓</span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dark / Light toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDark}
              className="p-2 text-foreground hover:bg-muted"
              title={darkMode ? t("lightMode") : t("darkMode")}
            >
              {darkMode ? (
                <FiSun className="h-4 w-4" />
              ) : (
                <FiMoon className="h-4 w-4" />
              )}
            </Button>

            {/* Avatar + user info + logout dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 px-2 text-foreground hover:bg-muted"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="max-w-[100px] truncate text-xs font-medium leading-none">
                      {user?.name}
                    </p>
                    <span
                      className={clsx(
                        "mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-medium capitalize",
                        roleBadgeColor,
                      )}
                    >
                      {user?.role}
                    </span>
                  </div>
                  <FiChevronDown className="hidden h-3 w-3 shrink-0 md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user?.name}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {user?.role}
                  </p>
                </div>
                <div className="my-1 border-t border-border" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <FiLogOut className="h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
