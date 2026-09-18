import { addTaxBreakdowns, computeTaxBreakdown, EMPTY_TAX_BREAKDOWN } from "./orderMath";
import { supabase } from "./supabaseClient";
import type { InterimReport, InterimSlot, Order } from "./types";

export function todayJst(): string {
  return jstDateOf(new Date().toISOString());
}

export function jstDateOf(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export function jstDayBoundsUtc(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function fetchCompletedOrders(businessDate: string, upToIso?: string): Promise<Order[]> {
  const { startIso, endIso } = jstDayBoundsUtc(businessDate);
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "completed")
    .eq("is_practice", false)
    .gte("completed_at", startIso)
    .lt("completed_at", upToIso && upToIso < endIso ? upToIso : endIso)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
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

export async function recordInterimSnapshot(slot: InterimSlot) {
  const now = new Date();
  const businessDate = jstDateOf(now.toISOString());
  const orders = await fetchCompletedOrders(businessDate, now.toISOString());
  const { error } = await supabase.from("interim_reports").upsert(
    {
      business_date: businessDate,
      slot,
      recorded_at: now.toISOString(),
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
