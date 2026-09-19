"use client";

import { useEffect, useState } from "react";
import { orderTotal } from "./orderMath";
import { supabase } from "./supabaseClient";
import type { Order, OrderLine, PaymentSplit } from "./types";

export {
  addTaxBreakdowns,
  computeTaxBreakdown,
  EMPTY_TAX_BREAKDOWN,
  lineUnitPrice,
  orderTotal,
  taxExcludedTotal,
  totalTax,
} from "./orderMath";

async function fetchOpenOrders(isPractice: boolean): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "open")
    .eq("is_practice", isPractice)
    .order("created_at");
  if (error) throw error;
  return data as Order[];
}

export function useOpenOrders(isPractice: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchOpenOrders(isPractice).then((data) => {
      if (active) {
        setOrders(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`orders_list_changes_${isPractice}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOpenOrders(isPractice).then((data) => {
          if (active) setOrders(data);
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isPractice]);

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

export async function createOrder(
  tableNumber: string,
  partySize: number,
  isPractice: boolean
): Promise<string> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      table_number: tableNumber,
      party_size: partySize,
      status: "open",
      lines: [],
      total: 0,
      is_practice: isPractice,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deletePracticeOrders() {
  const { error } = await supabase.from("orders").delete().eq("is_practice", true);
  if (error) throw error;
}

export async function updateOrderServed(id: string, served: boolean) {
  const { error } = await supabase.from("orders").update({ served }).eq("id", id);
  if (error) throw error;
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

export async function updateOrderPayments(id: string, payments: PaymentSplit[]) {
  const { error } = await supabase.from("orders").update({ payments }).eq("id", id);
  if (error) throw error;
}

export async function deleteOrder(id: string) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}
