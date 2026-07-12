/**
 * API service layer — mirrors the original axiosClient API surface.
 * All functions return Promises; internally uses the in-memory db store.
 */

import {
  db,
  getAll,
  getById,
  getWhere,
  create,
  update,
  patch,
  remove,
} from "./db";

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    getWhere("users", (u) => u.email === email && u.password === password),
  findByEmail: (email) => getWhere("users", (u) => u.email === email),
  resetPassword: (id, password) => patch("users", id, { password }),
};

// ── Users (login accounts) ────────────────────────────────────────────────────
// Separate from authApi — used by EmployeesPage to keep login accounts in sync.
export const usersApi = {
  getAll: () => getAll("users"),
  findByEmail: (email) => getWhere("users", (u) => u.email === email),
  findByEmployeeId: (empId) =>
    getWhere("users", (u) => u.employeeId === empId),
  create: (data) => create("users", data),
  update: (id, data) => update("users", id, data),
  deleteByEmployeeId: async (empId) => {
    const matches = await getWhere("users", (u) => u.employeeId === empId);
    if (matches.length > 0) return remove("users", matches[0].id);
    return null;
  },
  updateByEmployeeId: async (empId, data) => {
    const matches = await getWhere("users", (u) => u.employeeId === empId);
    if (matches.length > 0) return update("users", matches[0].id, data);
    return null;
  },
};

// ── Fuel Types ────────────────────────────────────────────────────────────────
export const fuelTypesApi = {
  getAll: () => getAll("fuelTypes"),
  getById: (id) => getById("fuelTypes", id),
  create: (data) => create("fuelTypes", data),
  update: (id, data) => update("fuelTypes", id, data),
  delete: (id) => remove("fuelTypes", id),
};

// ── Tanks ─────────────────────────────────────────────────────────────────────
export const tanksApi = {
  getAll: () => getAll("tanks"),
  getById: (id) => getById("tanks", id),
  create: (data) => create("tanks", data),
  update: (id, data) => update("tanks", id, data),
  patch: (id, data) => patch("tanks", id, data),
  delete: (id) => remove("tanks", id),
};

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesApi = {
  getAll: () => getAll("employees"),
  getById: (id) => getById("employees", id),
  create: (data) => create("employees", data),
  update: (id, data) => update("employees", id, data),
  delete: (id) => remove("employees", id),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  getAll: () => getAll("customers"),
  getById: (id) => getById("customers", id),
  create: (data) => create("customers", data),
  update: (id, data) => update("customers", id, data),
  patch: (id, data) => patch("customers", id, data),
  delete: (id) => remove("customers", id),
};

// ── Fuel Prices ───────────────────────────────────────────────────────────────
export const fuelPricesApi = {
  getAll: () => getAll("fuelPrices"),
  create: (data) => create("fuelPrices", data),
  update: (id, data) => update("fuelPrices", id, data),
};

// ── Purchases ─────────────────────────────────────────────────────────────────
export const purchasesApi = {
  getAll: () => getAll("purchases"),
  getById: (id) => getById("purchases", id),
  create: (data) => create("purchases", data),
  update: (id, data) => update("purchases", id, data),
  delete: (id) => remove("purchases", id),
};

// ── Sales ─────────────────────────────────────────────────────────────────────
export const salesApi = {
  getAll: () => getAll("sales"),
  getById: (id) => getById("sales", id),
  create: (data) => create("sales", data),
  update: (id, data) => update("sales", id, data),
  delete: (id) => remove("sales", id),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  getAll: () => getAll("expenses"),
  create: (data) => create("expenses", data),
  update: (id, data) => update("expenses", id, data),
  delete: (id) => remove("expenses", id),
};

// ── Losses ────────────────────────────────────────────────────────────────────
export const lossesApi = {
  getAll: () => getAll("losses"),
  create: (data) => create("losses", data),
  update: (id, data) => update("losses", id, data),
  delete: (id) => remove("losses", id),
};

// ── Cash Handovers ────────────────────────────────────────────────────────────
export const cashHandoversApi = {
  getAll: () => getAll("cashHandovers"),
  create: (data) => create("cashHandovers", data),
  update: (id, data) => update("cashHandovers", id, data),
  patch: (id, data) => patch("cashHandovers", id, data),
  delete: (id) => remove("cashHandovers", id),
};

// ── Cash Storages ─────────────────────────────────────────────────────────────
export const cashStoragesApi = {
  getAll: () => getAll("cashStorages"),
  create: (data) => create("cashStorages", data),
  update: (id, data) => update("cashStorages", id, data),
  patch: (id, data) => patch("cashStorages", id, data),
  delete: (id) => remove("cashStorages", id),
};

// ── Supplier Payments ─────────────────────────────────────────────────────────
export const supplierPaymentsApi = {
  getAll: () => getAll("supplierPayments"),
  create: (data) => create("supplierPayments", data),
  update: (id, data) => update("supplierPayments", id, data),
  delete: (id) => remove("supplierPayments", id),
};

// ── Customer Payments ─────────────────────────────────────────────────────────
export const customerPaymentsApi = {
  getAll: () => getAll("customerPayments"),
  create: (data) => create("customerPayments", data),
  delete: (id) => remove("customerPayments", id),
};

// Re-export db for direct access when needed
export { db };
