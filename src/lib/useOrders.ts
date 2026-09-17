"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Order, OrderLine, PaymentMethod } from "./types";

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

export function orderTotal(lines: OrderLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

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

export async function completeOrder(
  id: string,
  payment: { paymentMethod: PaymentMethod; receivedAmount: number; changeAmount: number }
) {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      payment_method: payment.paymentMethod,
      received_amount: payment.receivedAmount,
      change_amount: payment.changeAmount,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteOrder(id: string) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}
