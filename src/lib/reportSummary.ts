import {
  addTaxBreakdowns,
  computeTaxBreakdown,
  EMPTY_TAX_BREAKDOWN,
  lineUnitPrice,
  taxExcludedTotal,
} from "./orderMath";
import { supabase } from "./supabaseClient";
import { DRINK_CATEGORIES } from "./types";
import type {
  AbcRank,
  AbcRow,
  FoodDrinkSplit,
  InterimReport,
  InterimSlot,
  MenuItem,
  Order,
} from "./types";

export function todayJst(): string {
  return jstDateOf(new Date().toISOString());
}

export function thisMonthJst(): string {
  return todayJst().slice(0, 7);
}

export function jstDateOf(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export function jstDayBoundsUtc(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function jstMonthBoundsUtc(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(`${yearMonth}-01T00:00:00+09:00`);
  const nextYearMonth =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const end = new Date(`${nextYearMonth}-01T00:00:00+09:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function fetchCompletedOrdersInRange(startIso: string, endIso: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "completed")
    .eq("is_practice", false)
    .gte("completed_at", startIso)
    .lt("completed_at", endIso)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function fetchCompletedOrders(businessDate: string, upToIso?: string): Promise<Order[]> {
  const { startIso, endIso } = jstDayBoundsUtc(businessDate);
  return fetchCompletedOrdersInRange(startIso, upToIso && upToIso < endIso ? upToIso : endIso);
}

export async function fetchCompletedOrdersForMonth(yearMonth: string): Promise<Order[]> {
  const { startIso, endIso } = jstMonthBoundsUtc(yearMonth);
  return fetchCompletedOrdersInRange(startIso, endIso);
}

export function summarizeOrders(orders: Order[]) {
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const totalGuests = orders.reduce((sum, order) => sum + order.party_size, 0);
  const totalsByMethod: Record<string, number> = {};
  const countsByMethod: Record<string, number> = {};
  let taxBreakdown = EMPTY_TAX_BREAKDOWN;
  for (const order of orders) {
    for (const payment of order.payments) {
      totalsByMethod[payment.method] = (totalsByMethod[payment.method] ?? 0) + payment.amount;
      countsByMethod[payment.method] = (countsByMethod[payment.method] ?? 0) + 1;
    }
    taxBreakdown = addTaxBreakdowns(taxBreakdown, computeTaxBreakdown(order.lines));
  }
  return {
    order_count: orders.length,
    total_guests: totalGuests,
    total_sales: totalSales,
    totals_by_method: totalsByMethod,
    counts_by_method: countsByMethod,
    tax_breakdown: taxBreakdown,
  };
}

export async function closeDay(businessDate: string, orders: Order[]) {
  const { error } = await supabase.from("daily_closings").insert({
    business_date: businessDate,
    ...summarizeOrders(orders),
  });
  if (error) throw error;
}

export async function recomputeClosingIfExists(businessDate: string) {
  const { data: existing, error: findError } = await supabase
    .from("daily_closings")
    .select("id")
    .eq("business_date", businessDate)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return;

  const orders = await fetchCompletedOrders(businessDate);
  const { error } = await supabase
    .from("daily_closings")
    .update(summarizeOrders(orders))
    .eq("id", existing.id);
  if (error) throw error;
}

export async function recordInterimSnapshot(slot: InterimSlot, options?: { manual?: boolean }) {
  const manual = options?.manual ?? false;
  const now = new Date();
  const businessDate = jstDateOf(now.toISOString());

  if (!manual) {
    const { data: existing, error: findError } = await supabase
      .from("interim_reports")
      .select("recorded_manually")
      .eq("business_date", businessDate)
      .eq("slot", slot)
      .maybeSingle();
    if (findError) throw findError;
    if (existing?.recorded_manually) return;
  }

  const orders = await fetchCompletedOrders(businessDate, now.toISOString());
  const { error } = await supabase.from("interim_reports").upsert(
    {
      business_date: businessDate,
      slot,
      recorded_at: now.toISOString(),
      recorded_manually: manual,
      ...summarizeOrders(orders),
    },
    { onConflict: "business_date,slot" }
  );
  if (error) throw error;
}

export async function fetchInterimReports(businessDate: string): Promise<InterimReport[]> {
  const { data, error } = await supabase
    .from("interim_reports")
    .select("*")
    .eq("business_date", businessDate)
    .order("slot", { ascending: true });
  if (error) throw error;
  return data as InterimReport[];
}

const ABC_RANK_A_THRESHOLD = 0.7;
const ABC_RANK_B_THRESHOLD = 0.9;

export function computeAbcAnalysis(orders: Order[]): AbcRow[] {
  const totals = new Map<string, { name: string; qty: number; revenue: number; tax: ReturnType<typeof computeTaxBreakdown> }>();
  for (const order of orders) {
    for (const line of order.lines) {
      const key = line.menuItemId;
      const revenue = lineUnitPrice(line) * line.qty;
      const lineTax = computeTaxBreakdown([line]);
      const existing = totals.get(key);
      if (existing) {
        existing.qty += line.qty;
        existing.revenue += revenue;
        existing.tax = addTaxBreakdowns(existing.tax, lineTax);
      } else {
        totals.set(key, { name: line.name, qty: line.qty, revenue, tax: lineTax });
      }
    }
  }

  const rows = [...totals.entries()]
    .map(([menuItemId, v]) => ({
      menuItemId,
      name: v.name,
      qty: v.qty,
      revenue: v.revenue,
      revenueExTax: taxExcludedTotal(v.tax),
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  let cumulativeRevenue = 0;
  return rows.map((r) => {
    cumulativeRevenue += r.revenue;
    const share = totalRevenue > 0 ? r.revenue / totalRevenue : 0;
    const cumulativeShare = totalRevenue > 0 ? cumulativeRevenue / totalRevenue : 0;
    const rank: AbcRank =
      cumulativeShare <= ABC_RANK_A_THRESHOLD ? "A" : cumulativeShare <= ABC_RANK_B_THRESHOLD ? "B" : "C";
    return {
      menuItemId: r.menuItemId,
      name: r.name,
      qty: r.qty,
      revenue: r.revenue,
      revenueExTax: r.revenueExTax,
      share,
      cumulativeShare,
      rank,
    };
  });
}

export function computeFoodDrinkSplit(orders: Order[], menu: MenuItem[]): FoodDrinkSplit {
  const categoryById = new Map(menu.map((m) => [m.id, m.category]));
  let foodRevenue = 0;
  let foodQty = 0;
  let foodTax = EMPTY_TAX_BREAKDOWN;
  let drinkRevenue = 0;
  let drinkQty = 0;
  let drinkTax = EMPTY_TAX_BREAKDOWN;

  for (const order of orders) {
    for (const line of order.lines) {
      const category = categoryById.get(line.menuItemId);
      const revenue = lineUnitPrice(line) * line.qty;
      const lineTax = computeTaxBreakdown([line]);
      if (category && DRINK_CATEGORIES.has(category)) {
        drinkRevenue += revenue;
        drinkQty += line.qty;
        drinkTax = addTaxBreakdowns(drinkTax, lineTax);
      } else {
        foodRevenue += revenue;
        foodQty += line.qty;
        foodTax = addTaxBreakdowns(foodTax, lineTax);
      }
    }
  }

  const total = foodRevenue + drinkRevenue;
  return {
    food: {
      revenue: foodRevenue,
      revenueExTax: taxExcludedTotal(foodTax),
      qty: foodQty,
      share: total > 0 ? foodRevenue / total : 0,
    },
    drink: {
      revenue: drinkRevenue,
      revenueExTax: taxExcludedTotal(drinkTax),
      qty: drinkQty,
      share: total > 0 ? drinkRevenue / total : 0,
    },
  };
}
