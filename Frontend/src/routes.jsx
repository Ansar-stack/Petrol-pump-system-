import { Navigate } from "react-router-dom";

import AccountsPayablePage from "@/pages/accounts/AccountsPayablePage";
import CashHandoversPage from "@/pages/accounts/CashHandoversPage";
import CashStoragePage from "@/pages/accounts/CashStoragePage";
import CustomersPage from "@/pages/CustomersPage";
import DashboardPage from "@/pages/DashboardPage";
import EmployeesPage from "@/pages/EmployeesPage";
import EmployeeSalesPage from "@/pages/EmployeeSalesPage";
import ExpensesPage from "@/pages/ExpensesPage";

import FuelTypesPage from "@/pages/fuel/FuelTypesPage";
import PurchasesPage from "@/pages/fuel/PurchasesPage";
import TanksPage from "@/pages/fuel/TanksPage";
import LoginPage from "@/pages/LoginPage";
import LossManagementPage from "@/pages/LossManagementPage";
import ProfitLossPage from "@/pages/ProfitLossPage";
import ReportsPage from "@/pages/ReportsPage";
import SalesPage from "@/pages/SalesPage";

export const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/dashboard", element: <DashboardPage /> },
  {
    path: "/fuel/types",
    element: <FuelTypesPage />,
    roles: ["admin", "manager"],
  },
  { path: "/fuel/tanks", element: <TanksPage />, roles: ["admin", "manager"] },
  {
    path: "/fuel/purchases",
    element: <PurchasesPage />,
    roles: ["admin", "manager"],
  },
  {
    path: "/employees",
    element: <EmployeesPage />,
    roles: ["admin", "manager"],
  },
  { path: "/customers", element: <CustomersPage /> },
  { path: "/sales", element: <SalesPage /> },
  { path: "/employee-sales", element: <EmployeeSalesPage /> },
  {
    path: "/accounts/payable",
    element: <AccountsPayablePage />,
    roles: ["admin", "manager"],
  },
  {
    path: "/accounts/handovers",
    element: <CashHandoversPage />,
  },
  {
    path: "/accounts/storage",
    element: <CashStoragePage />,
    roles: ["admin", "manager"],
  },
  {
    path: "/profit-loss",
    element: <ProfitLossPage />,
    roles: ["admin", "manager"],
  },
  { path: "/expenses", element: <ExpensesPage />, roles: ["admin", "manager"] },
  {
    path: "/losses",
    element: <LossManagementPage />,
    roles: ["admin", "manager"],
  },
  { path: "/reports", element: <ReportsPage />, roles: ["admin", "manager"] },
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
];
const empt = 34;
