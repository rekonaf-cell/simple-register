"use client";

import { useState } from "react";
import type { Topping } from "@/lib/types";
import { addTopping, deleteTopping, updateTopping, useToppings } from "@/lib/useToppings";

export default function ToppingsEditor() {
  const { toppings, loading } = useToppings();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const priceNum = Number(price);
    if (!trimmed || !Number.isFinite(priceNum) || priceNum < 0) return;
    addTopping({ name: trimmed, price: priceNum, sort_order: 0 });
    setName("");
    setPrice("");
  }

  function updateItem(id: string, patch: Partial<Omit<Topping, "id">>) {
    updateTopping(id, patch);
  }

  function removeItem(id: string) {
    if (!window.confirm("このトッピングを削除しますか？")) return;
    deleteTopping(id);
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <form onSubmit={addItem} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow sm:flex-row">
        <input
          type="text"
          placeholder="トッピング名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="価格"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          min={0}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:w-28"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700"
        >
          追加
        </button>
      </form>

      {toppings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
          トッピングがありません。上のフォームから追加してください。
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl bg-white shadow">
          {toppings.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <input
                type="text"
                value={t.name}
                onChange={(e) => updateItem(t.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm focus:border-zinc-300"
              />
              <input
                type="number"
                inputMode="numeric"
                value={t.price}
                onChange={(e) => updateItem(t.id, { price: Number(e.target.value) || 0 })}
                min={0}
                className="w-20 rounded-lg border border-transparent px-2 py-1 text-right text-sm focus:border-zinc-300"
              />
              <button onClick={() => removeItem(t.id)} className="text-xs text-red-500">
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
