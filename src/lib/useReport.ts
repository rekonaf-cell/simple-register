"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { DailyClosing, Order } from "./types";

export function todayJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function jstDayBoundsUtc(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function fetchCompletedOrders(businessDate: string): Promise<Order[]> {
  const { startIso, endIso } = jstDayBoundsUtc(businessDate);
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "completed")
    .gte("completed_at", startIso)
    .lt("completed_at", endIso)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export function useCompletedOrders(businessDate: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchCompletedOrders(businessDate).then((data) => {
      if (active) {
        setOrders(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`completed_orders_${businessDate}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchCompletedOrders(businessDate).then((data) => {
          if (active) setOrders(data);
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [businessDate]);

  return { orders, loading };
}

async function fetchDailyClosing(businessDate: string): Promise<DailyClosing | null> {
  const { data, error } = await supabase
    .from("daily_closings")
    .select("*")
    .eq("business_date", businessDate)
    .maybeSingle();
  if (error) throw error;
  return data as DailyClosing | null;
}

export function useDailyClosing(businessDate: string) {
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchDailyClosing(businessDate).then((data) => {
      if (active) {
        setClosing(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`daily_closing_${businessDate}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_closings", filter: `business_date=eq.${businessDate}` },
        () => {
          fetchDailyClosing(businessDate).then((data) => {
            if (active) setClosing(data);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [businessDate]);

  return { closing, loading };
}

export async function closeDay(businessDate: string, orders: Order[]) {
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const totalsByMethod: Record<string, number> = {};
  for (const order of orders) {
    for (const payment of order.payments) {
      totalsByMethod[payment.method] = (totalsByMethod[payment.method] ?? 0) + payment.amount;
    }
  }

  const { error } = await supabase.from("daily_closings").insert({
    business_date: businessDate,
    order_count: orders.length,
    total_sales: totalSales,
    totals_by_method: totalsByMethod,
  });
  if (error) throw error;
}
