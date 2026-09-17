"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type Category, type MenuItem, type PaymentMethod } from "@/lib/types";
import { useMenu } from "@/lib/useMenu";
import { completeOrder, deleteOrder, updateOrderLines, updateOrderMeta, useOrder } from "@/lib/useOrders";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function OrderEditor({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { menu } = useMenu();
  const { order, loading } = useOrder(orderId);
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [receivedInput, setReceivedInput] = useState("");
  const [completing, setCompleting] = useState(false);

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">読み込み中...</p>;
  }

  if (!order) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-zinc-500">
          この注文は見つかりません。会計済みか、削除された可能性があります。
        </p>
        <Link href="/" className="text-sm font-semibold text-zinc-900 underline">
          テーブル一覧に戻る
        </Link>
      </div>
    );
  }

  const lines = order.lines;
  const total = order.total;
  const totalCount = lines.reduce((sum, l) => sum + l.qty, 0);

  function addItem(item: MenuItem) {
    if (!order) return;
    const existing = lines.find((l) => l.menuItemId === item.id);
    const next = existing
      ? lines.map((l) => (l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l))
      : [...lines, { menuItemId: item.id, name: item.name, price: item.price, qty: 1 }];
    updateOrderLines(orderId, next);
  }

  function changeQty(menuItemId: string, delta: number) {
    const next = lines
      .map((l) => (l.menuItemId === menuItemId ? { ...l, qty: l.qty + delta } : l))
      .filter((l) => l.qty > 0);
    updateOrderLines(orderId, next);
  }

  function removeLine(menuItemId: string) {
    updateOrderLines(orderId, lines.filter((l) => l.menuItemId !== menuItemId));
  }

  const receivedAmount = Number(receivedInput);
  const changeAmount = receivedAmount - total;
  const canConfirm =
    paymentMethod !== null &&
    (paymentMethod !== "cash" || (Number.isFinite(receivedAmount) && receivedAmount >= total));

  function openCheckout() {
    if (lines.length === 0) return;
    setPaymentMethod(null);
    setReceivedInput("");
    setCheckoutOpen(true);
  }

  async function confirmCheckout() {
    if (!canConfirm || !paymentMethod) return;
    setCompleting(true);
    try {
      await completeOrder(orderId, {
        paymentMethod,
        receivedAmount: paymentMethod === "cash" ? receivedAmount : total,
        changeAmount: paymentMethod === "cash" ? changeAmount : 0,
      });
      router.push("/");
    } finally {
      setCompleting(false);
    }
  }

  async function removeTable() {
    if (!window.confirm("このテーブルを削除しますか？注文内容も失われます。")) return;
    await deleteOrder(orderId);
    router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-40">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500">
          ← テーブル一覧
        </Link>
        <button onClick={removeTable} className="text-xs text-red-500">
          テーブルを削除
        </button>
      </div>

      <section className="flex gap-2 rounded-xl bg-white p-3 shadow">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-zinc-500">テーブル番号</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="例: 5"
            value={order.table_number}
            onChange={(e) => updateOrderMeta(orderId, { table_number: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-xs font-semibold text-zinc-500">人数</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={order.party_size}
            onChange={(e) =>
              updateOrderMeta(orderId, { party_size: Math.max(1, Number(e.target.value) || 1) })
            }
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        {menu.length === 0 ? (
          <>
            <h2 className="text-sm font-semibold text-zinc-500">メニュー</h2>
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
              メニューが登録されていません。「メニュー管理」から追加してください。
            </p>
          </>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                    activeCategory === category
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 shadow"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            {(() => {
              const items = menu.filter((item) => item.category === activeCategory);
              if (items.length === 0) {
                return (
                  <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                    このカテゴリーにはメニューがありません。
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl bg-white px-2 py-3 text-center shadow active:scale-95 active:bg-zinc-100"
                    >
                      <span className="text-sm font-medium text-zinc-900">{item.name}</span>
                      <span className="text-xs text-zinc-500">{formatYen(item.price)}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">注文内容</h2>
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
            上のメニューをタップして注文を追加してください。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl bg-white shadow">
            {lines.map((line) => (
              <li key={line.menuItemId} className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{line.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatYen(line.price)} × {line.qty} = {formatYen(line.price * line.qty)}
                  </p>
                </div>
                <button
                  onClick={() => changeQty(line.menuItemId, -1)}
                  className="h-8 w-8 rounded-full bg-zinc-100 text-lg font-bold text-zinc-700 active:bg-zinc-200"
                  aria-label="数量を減らす"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                <button
                  onClick={() => changeQty(line.menuItemId, 1)}
                  className="h-8 w-8 rounded-full bg-zinc-100 text-lg font-bold text-zinc-700 active:bg-zinc-200"
                  aria-label="数量を増やす"
                >
                  ＋
                </button>
                <button onClick={() => removeLine(line.menuItemId)} className="ml-1 text-xs text-red-500">
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {!checkoutOpen ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">
                  {order.table_number && `${order.table_number}番 `}
                  {order.party_size}名 ・ {totalCount}点
                </p>
                <p className="text-2xl font-bold text-zinc-900">{formatYen(total)}</p>
              </div>
              <button
                onClick={openCheckout}
                disabled={lines.length === 0}
                className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
              >
                会計する
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">お会計</span>
                <span className="text-xl font-bold text-zinc-900">{formatYen(total)}</span>
              </div>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                      paymentMethod === method
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
              {paymentMethod === "cash" && (
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="mb-1 block text-xs font-semibold text-zinc-500">預かり金額</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="例: 2000"
                      value={receivedInput}
                      onChange={(e) => setReceivedInput(e.target.value)}
                      min={0}
                      autoFocus
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex-1 text-right">
                    <span className="mb-1 block text-xs font-semibold text-zinc-500">お釣り</span>
                    <span className="text-lg font-bold text-zinc-900">
                      {Number.isFinite(changeAmount) && changeAmount >= 0 ? formatYen(changeAmount) : "―"}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="flex-1 rounded-full border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-600 active:bg-zinc-100"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmCheckout}
                  disabled={!canConfirm || completing}
                  className="flex-1 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
                >
                  会計を確定
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
