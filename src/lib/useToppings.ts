"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Topping } from "./types";

async function fetchToppings(): Promise<Topping[]> {
  const { data, error } = await supabase.from("toppings").select("*").order("sort_order");
  if (error) throw error;
  return data as Topping[];
}

export function useToppings() {
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchToppings().then((data) => {
      if (active) {
        setToppings(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel("toppings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "toppings" }, () => {
        fetchToppings().then((data) => {
          if (active) setToppings(data);
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { toppings, loading };
}

export async function addTopping(topping: Omit<Topping, "id">) {
  const { error } = await supabase.from("toppings").insert(topping);
  if (error) throw error;
}

export async function updateTopping(id: string, patch: Partial<Omit<Topping, "id">>) {
  const { error } = await supabase.from("toppings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTopping(id: string) {
  const { error } = await supabase.from("toppings").delete().eq("id", id);
  if (error) throw error;
}
