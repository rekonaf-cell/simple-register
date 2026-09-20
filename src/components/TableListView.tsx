"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePracticeMode } from "@/lib/practiceMode";
import {
  createOrder,
  deletePracticeOrders,
  mergeOrders,
  updateOrderServed,
  useOpenOrders,
} from "@/lib/useOrders";
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
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

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

  function toggleMergeMode() {
    setMergeMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(orderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const selectedTotal = selectedOrders.reduce((sum, o) => sum + o.total, 0);

  async function handleMerge() {
    if (selectedIds.size < 2) return;
    const label = selectedOrders.map((o) => o.table_number || "番号未設定").join(" + ");
    if (!window.confirm(`${label} を1つのテーブルに合算します。よろしいですか？`)) return;
    setMerging(true);
    try {
      const newId = await mergeOrders([...selectedIds]);
      setMergeMode(false);
      setSelectedIds(new Set());
      router.push(`/order/${newId}`);
    } finally {
      setMerging(false);
    }
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
          {orders.length >= 2 && (
            <button
              onClick={toggleMergeMode}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                mergeMode ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-600"
              }`}
            >
              {mergeMode ? "合算をやめる" : "テーブル合算"}
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

      {mergeMode && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500">
          合算するテーブルを2つ以上タップして選んでください。
        </p>
      )}

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
        <ul className="grid grid-cols-1 gap-2 pb-24 sm:grid-cols-2">
          {orders.map((order) => {
            const selected = selectedIds.has(order.id);
            if (mergeMode) {
              return (
                <li key={order.id}>
                  <button
                    onClick={() => toggleSelected(order.id)}
                    className={`w-full rounded-xl p-4 text-left shadow ${
                      selected
                        ? "bg-zinc-900 text-white"
                        : order.served
                          ? "bg-emerald-50 text-zinc-900"
                          : "bg-amber-50 text-zinc-900"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-base font-semibold">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                          selected ? "border-white bg-white text-zinc-900" : "border-zinc-400"
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      {order.table_number ? `${order.table_number}番` : "番号未設定"} ・ {order.party_size}名
                    </p>
                    <p className={`mt-1 text-sm ${selected ? "text-zinc-200" : "text-zinc-500"}`}>
                      {order.lines.reduce((sum, l) => sum + l.qty, 0)}点 ・ {formatYen(order.total)}
                    </p>
                  </button>
                </li>
              );
            }
            return (
              <li
                key={order.id}
                className={`flex overflow-hidden rounded-xl shadow ${
                  order.served ? "bg-emerald-50" : "bg-amber-50"
                }`}
              >
                <Link href={`/order/${order.id}`} className="flex-1 p-4 active:bg-black/5">
                  <p className="text-base font-semibold text-zinc-900">
                    {order.table_number ? `${order.table_number}番` : "番号未設定"} ・ {order.party_size}名
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {order.lines.reduce((sum, l) => sum + l.qty, 0)}点 ・ {formatYen(order.total)}
                  </p>
                </Link>
                {order.served ? (
                  <Link
                    href={`/order/${order.id}?checkout=1`}
                    className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 bg-emerald-500 text-sm font-bold text-white active:bg-emerald-600"
                  >
                    <span className="text-xl">✓</span>
                    <span>会計</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => toggleServed(order)}
                    className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 bg-amber-400 text-sm font-bold text-white active:bg-amber-500"
                  >
                    <span className="text-xl">○</span>
                    <span>未提供</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mergeMode && selectedIds.size >= 2 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {selectedIds.size}卓選択中 ・ 合計 {formatYen(selectedTotal)}
            </p>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
            >
              合算する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
