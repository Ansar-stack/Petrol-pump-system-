/**
 * In-memory database initialized from local JSON data files.
 * All mutations operate on this store; changes persist for the session.
 */

import usersData from "@/components/data/users.json";
import fuelTypesData from "@/components/data/fuelTypes.json";
import tanksData from "@/components/data/tanks.json";
import employeesData from "@/components/data/employees.json";
import customersData from "@/components/data/customers.json";
import fuelPricesData from "@/components/data/fuelPrices.json";
import purchasesData from "@/components/data/purchases.json";
import salesData from "@/components/data/sales.json";
import expensesData from "@/components/data/expenses.json";
import lossesData from "@/components/data/losses.json";
import cashHandoversData from "@/components/data/cashHandovers.json";
import cashStoragesData from "@/components/data/cashStorages.json";
import supplierPaymentsData from "@/components/data/supplierPayments.json";
import customerPaymentsData from "@/components/data/customerPayments.json";

// Deep-clone seed data so JSON imports stay immutable
const clone = (data) => JSON.parse(JSON.stringify(data));

export const db = {
  users: clone(usersData),
  fuelTypes: clone(fuelTypesData),
  tanks: clone(tanksData),
  employees: clone(employeesData),
  customers: clone(customersData),
  fuelPrices: clone(fuelPricesData),
  purchases: clone(purchasesData),
  sales: clone(salesData),
  expenses: clone(expensesData),
  losses: clone(lossesData),
  cashHandovers: clone(cashHandoversData),
  cashStorages: clone(cashStoragesData),
  supplierPayments: clone(supplierPaymentsData),
  customerPayments: clone(customerPaymentsData),
};

/** Generate a simple incremental id within a collection */
export function nextId(collection) {
  if (collection.length === 0) return "1";
  const maxId = Math.max(
    ...collection.map((item) => parseInt(item.id, 10) || 0),
  );
  return String(maxId + 1);
}

/** Simulate async latency (feel like real API) */
const delay = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Generic CRUD helpers ──────────────────────────────────────────────────────

export async function getAll(table) {
  await delay();
  return [...db[table]];
}

export async function getById(table, id) {
  await delay();
  return db[table].find((item) => item.id === id) ?? null;
}

export async function getWhere(table, predicate) {
  await delay();
  return db[table].filter(predicate);
}

export async function create(table, data) {
  await delay();
  const newItem = { id: nextId(db[table]), ...data };
  db[table].push(newItem);
  return newItem;
}

export async function update(table, id, data) {
  await delay();
  const idx = db[table].findIndex((item) => item.id === id);
  if (idx === -1) throw new Error(`Record ${id} not found in ${table}`);
  db[table][idx] = { ...db[table][idx], ...data };
  return db[table][idx];
}

export async function patch(table, id, data) {
  return update(table, id, data);
}

export async function remove(table, id) {
  await delay();
  const idx = db[table].findIndex((item) => item.id === id);
  if (idx === -1) throw new Error(`Record ${id} not found in ${table}`);
  db[table].splice(idx, 1);
  return { id };
}
