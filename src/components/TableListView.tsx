"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrder, useOpenOrders } from "@/lib/useOrders";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function TableListView() {
  const router = useRouter();
  const { orders, loading } = useOpenOrders();
  const [showForm, setShowForm] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const id = await createOrder(tableNumber, partySize);
      router.push(`/order/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500">進行中のテーブル</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700"
        >
          + 新規テーブル
        </button>
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
              type="number"
              inputMode="numeric"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
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
            <li key={order.id}>
              <Link
                href={`/order/${order.id}`}
                className="block rounded-xl bg-white p-4 shadow active:bg-zinc-50"
              >
                <p className="text-base font-semibold text-zinc-900">
                  {order.table_number ? `${order.table_number}番` : "番号未設定"} ・ {order.party_size}名
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {order.lines.reduce((sum, l) => sum + l.qty, 0)}点 ・ {formatYen(order.total)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
