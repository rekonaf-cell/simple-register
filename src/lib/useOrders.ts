"use client";

import { useEffect, useState } from "react";
import { mergeOrderLines, orderTotal } from "./orderMath";
import { supabase } from "./supabaseClient";
import type { Order, OrderLine, PaymentSplit } from "./types";

export {
  addTaxBreakdowns,
  computeTaxBreakdown,
  EMPTY_TAX_BREAKDOWN,
  lineUnitPrice,
  mergeOrderLines,
  orderTotal,
  sameToppingSet,
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

export async function splitCheckout(params: {
  orderId: string;
  tableNumber: string;
  isPractice: boolean;
  selectedLines: OrderLine[];
  remainingLines: OrderLine[];
  payments: PaymentSplit[];
}) {
  const { orderId, tableNumber, isPractice, selectedLines, remainingLines, payments } = params;
  const { error: insertError } = await supabase.from("orders").insert({
    table_number: tableNumber ? `${tableNumber}（分割）` : "分割",
    party_size: 1,
    status: "completed",
    lines: selectedLines,
    total: orderTotal(selectedLines),
    completed_at: new Date().toISOString(),
    payments,
    is_practice: isPractice,
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("orders")
    .update({ lines: remainingLines, total: orderTotal(remainingLines) })
    .eq("id", orderId);
  if (updateError) throw updateError;
}

export async function mergeOrders(orderIds: string[]): Promise<string> {
  if (orderIds.length < 2) throw new Error("合算するテーブルは2つ以上選んでください。");

  const { data, error } = await supabase.from("orders").select("*").in("id", orderIds);
  if (error) throw error;
  const orders = data as Order[];
  if (orders.length !== orderIds.length) throw new Error("選択したテーブルの一部が見つかりませんでした。");

  const isPractice = orders[0].is_practice;
  if (orders.some((o) => o.is_practice !== isPractice)) {
    throw new Error("練習モードのテーブルと通常のテーブルは合算できません。");
  }

  const tableNumber = orders.map((o) => o.table_number || "?").join("+");
  const partySize = orders.reduce((sum, o) => sum + o.party_size, 0);
  const lines = mergeOrderLines(orders.map((o) => o.lines));

  const { data: created, error: insertError } = await supabase
    .from("orders")
    .insert({
      table_number: tableNumber,
      party_size: Math.max(1, partySize),
      status: "open",
      lines,
      total: orderTotal(lines),
      is_practice: isPractice,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const { error: deleteError } = await supabase.from("orders").delete().in("id", orderIds);
  if (deleteError) throw deleteError;

  return created.id as string;
}
