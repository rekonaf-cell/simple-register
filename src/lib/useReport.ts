"use client";

import { useEffect, useState } from "react";
import {
  fetchCompletedOrders,
  fetchInterimReports,
} from "./reportSummary";
import { supabase } from "./supabaseClient";
import type { DailyClosing, InterimReport, Order } from "./types";

export {
  closeDay,
  jstDateOf,
  recomputeClosingIfExists,
  recordInterimSnapshot,
  todayJst,
} from "./reportSummary";

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

export function useInterimReports(businessDate: string) {
  const [reports, setReports] = useState<InterimReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchInterimReports(businessDate).then((data) => {
      if (active) {
        setReports(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`interim_reports_${businessDate}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interim_reports", filter: `business_date=eq.${businessDate}` },
        () => {
          fetchInterimReports(businessDate).then((data) => {
            if (active) setReports(data);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [businessDate]);

  return { reports, loading };
}
