"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { MenuItem } from "./types";

async function fetchMenu(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("category")
    .order("sort_order");
  if (error) throw error;
  return data as MenuItem[];
}

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchMenu().then((data) => {
      if (active) {
        setMenu(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel("menu_items_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        fetchMenu().then((data) => {
          if (active) setMenu(data);
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { menu, loading };
}

export async function addMenuItem(item: Omit<MenuItem, "id">) {
  const { error } = await supabase.from("menu_items").insert(item);
  if (error) throw error;
}

export async function updateMenuItem(id: string, patch: Partial<Omit<MenuItem, "id">>) {
  const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMenuItem(id: string) {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderMenuItems(orderedIds: string[]) {
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("menu_items").update({ sort_order: index }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
