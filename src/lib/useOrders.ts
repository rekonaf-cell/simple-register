"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Order, OrderLine, PaymentSplit, TaxBreakdown } from "./types";

async function fetchOpenOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "open")
    .order("created_at");
  if (error) throw error;
  return data as Order[];
}

export function useOpenOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchOpenOrders().then((data) => {
      if (active) {
        setOrders(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel("orders_list_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOpenOrders().then((data) => {
          if (active) setOrders(data);
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { orders, loading };
}

async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Order | null;
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchOrder(id).then((data) => {
      if (active) {
        setOrder(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`order_${id}_changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => {
          fetchOrder(id).then((data) => {
            if (active) setOrder(data);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  return { order, loading };
}

export function lineUnitPrice(line: OrderLine) {
  return line.price + line.toppings.reduce((sum, t) => sum + t.price, 0);
}

export function orderTotal(lines: OrderLine[]) {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.qty, 0);
}

export function computeTaxBreakdown(lines: OrderLine[]): TaxBreakdown {
  let taxable8 = 0;
  let taxable10 = 0;
  for (const line of lines) {
    const amount = lineUnitPrice(line) * line.qty;
    if (line.taxRate === 0.08) taxable8 += amount;
    else taxable10 += amount;
  }
  return {
    taxable8,
    tax8: Math.round((taxable8 * 8) / 108),
    taxable10,
    tax10: Math.round((taxable10 * 10) / 110),
  };
}

export function addTaxBreakdowns(a: TaxBreakdown, b: TaxBreakdown): TaxBreakdown {
  return {
    taxable8: a.taxable8 + b.taxable8,
    tax8: a.tax8 + b.tax8,
    taxable10: a.taxable10 + b.taxable10,
    tax10: a.tax10 + b.tax10,
  };
}

export const EMPTY_TAX_BREAKDOWN: TaxBreakdown = { taxable8: 0, tax8: 0, taxable10: 0, tax10: 0 };

export async function createOrder(tableNumber: string, partySize: number): Promise<string> {
  const { data, error } = await supabase
    .from("orders")
    .insert({ table_number: tableNumber, party_size: partySize, status: "open", lines: [], total: 0 })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateOrderLines(id: string, lines: OrderLine[]) {
  const { error } = await supabase
    .from("orders")
    .update({ lines, total: orderTotal(lines) })
    .eq("id", id);
  if (error) throw error;
}

export async function updateOrderMeta(id: string, patch: { table_number?: string; party_size?: number }) {
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw error;
}

export async function completeOrder(id: string, payments: PaymentSplit[]) {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      payments,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteOrder(id: string) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}
