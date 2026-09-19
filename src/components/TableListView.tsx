"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePracticeMode } from "@/lib/practiceMode";
import { createOrder, deletePracticeOrders, updateOrderServed, useOpenOrders } from "@/lib/useOrders";
import type { Order } from "@/lib/types";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function normalizeTableNumber(value: string) {
  return value.trim().replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
}

export default function TableListView() {
  const router = useRouter();
  const practiceMode = usePracticeMode();
  const { orders, loading } = useOpenOrders(practiceMode);
  const [showForm, setShowForm] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = normalizeTableNumber(tableNumber);
    if (trimmed && orders.some((o) => normalizeTableNumber(o.table_number) === trimmed)) {
      window.alert(`テーブル番号「${trimmed}」は既に使用中です。`);
      return;
    }
    setCreating(true);
    try {
      const id = await createOrder(tableNumber, Math.max(1, parseInt(partySize, 10) || 1), practiceMode);
      router.push(`/order/${id}`);
    } finally {
      setCreating(false);
    }
  }

  function toggleServed(order: Order) {
    updateOrderServed(order.id, !order.served);
  }

  async function handleDeletePractice() {
    if (!window.confirm("練習データ（進行中・会計済みすべて）を削除しますか？")) return;
    await deletePracticeOrders();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500">
          {practiceMode ? "練習中のテーブル" : "進行中のテーブル"}
        </h2>
        <div className="flex items-center gap-2">
          {practiceMode && (
            <button onClick={handleDeletePractice} className="text-xs text-red-500">
              練習データを削除
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700"
          >
            + 新規テーブル
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 rounded-xl bg-white p-3 shadow">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold text-zinc-500">テーブル番号</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="例: 5"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              autoFocus
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-xs font-semibold text-zinc-500">人数</span>
            <input
              type="text"
              inputMode="numeric"
              value={partySize}
              onChange={(e) => setPartySize(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setPartySize((v) => (v === "" ? "1" : v))}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
          >
            開始
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
          進行中のテーブルはありません。「+ 新規テーブル」から開始してください。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {orders.map((order) => (
            <li
              key={order.id}
              className={`rounded-xl shadow ${order.served ? "bg-emerald-50" : "bg-white"}`}
            >
              <Link href={`/order/${order.id}`} className="block p-4 active:bg-black/5">
                <p className="text-base font-semibold text-zinc-900">
                  {order.table_number ? `${order.table_number}番` : "番号未設定"} ・ {order.party_size}名
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {order.lines.reduce((sum, l) => sum + l.qty, 0)}点 ・ {formatYen(order.total)}
                </p>
              </Link>
              <button
                onClick={() => toggleServed(order)}
                className={`w-full rounded-b-xl px-4 py-2 text-sm font-semibold ${
                  order.served
                    ? "bg-emerald-500 text-white active:bg-emerald-600"
                    : "bg-amber-50 text-amber-700 active:bg-amber-100"
                }`}
              >
                {order.served ? "提供済み" : "未提供"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
