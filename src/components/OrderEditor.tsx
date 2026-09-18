"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  TOPPING_CATEGORIES,
  taxRateForCategory,
  type Category,
  type MenuItem,
  type Order,
  type OrderLineTopping,
  type PaymentMethod,
  type PaymentSplit,
} from "@/lib/types";
import { useMenu } from "@/lib/useMenu";
import {
  completeOrder,
  computeTaxBreakdown,
  deleteOrder,
  lineUnitPrice,
  taxExcludedTotal,
  totalTax,
  updateOrderLines,
  updateOrderMeta,
  updateOrderPayments,
  useOrder,
} from "@/lib/useOrders";
import { jstDateOf, recomputeClosingIfExists } from "@/lib/useReport";
import { useToppings } from "@/lib/useToppings";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function sameToppingSet(a: OrderLineTopping[], b: OrderLineTopping[]) {
  if (a.length !== b.length) return false;
  const aIds = new Set(a.map((t) => t.id));
  return b.every((t) => aIds.has(t.id));
}

export default function OrderEditor({ orderId }: { orderId: string }) {
  const { order, loading } = useOrder(orderId);

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

  return <OrderEditorReady key={orderId} orderId={orderId} order={order} />;
}

function PaymentLegs({ payments, onRemove }: { payments: PaymentSplit[]; onRemove: (i: number) => void }) {
  if (payments.length === 0) return null;
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg bg-zinc-50">
      {payments.map((p, i) => (
        <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
          <div>
            <span className="font-medium text-zinc-900">{PAYMENT_METHOD_LABELS[p.method]}</span>
            {p.method === "cash" && p.received !== undefined && (
              <span className="ml-2 text-xs text-zinc-500">
                預かり{formatYen(p.received)} ・ お釣り{formatYen(p.change ?? 0)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900">{formatYen(p.amount)}</span>
            <button onClick={() => onRemove(i)} className="text-xs text-red-500">
              削除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OrderEditorReady({ orderId, order }: { orderId: string; order: Order }) {
  const router = useRouter();
  const { menu } = useMenu();
  const { toppings } = useToppings();
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentSplit[]>(() =>
    order.status === "completed" ? order.payments : []
  );
  const [activeMethod, setActiveMethod] = useState<PaymentMethod | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [completing, setCompleting] = useState(false);
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null);
  const [selectedToppingIds, setSelectedToppingIds] = useState<Set<string>>(new Set());

  const isCompleted = order.status === "completed";
  const lines = order.lines;
  const total = order.total;
  const totalCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const allServed = lines.length > 0 && lines.every((l) => l.served);
  const unservedCount = lines.filter((l) => !l.served).length;
  const tax = computeTaxBreakdown(lines);

  function addItemToOrder(item: MenuItem, chosenToppings: OrderLineTopping[]) {
    const existing = lines.find(
      (l) => l.menuItemId === item.id && sameToppingSet(l.toppings, chosenToppings)
    );
    const next = existing
      ? lines.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + 1, served: false } : l))
      : [
          ...lines,
          {
            id: crypto.randomUUID(),
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            qty: 1,
            toppings: chosenToppings,
            served: false,
            taxRate: taxRateForCategory(item.category),
          },
        ];
    updateOrderLines(orderId, next);
  }

  function handleItemTap(item: MenuItem) {
    if (TOPPING_CATEGORIES.has(item.category)) {
      setSelectedToppingIds(new Set());
      setPickerItem(item);
    } else {
      addItemToOrder(item, []);
    }
  }

  function toggleTopping(id: string) {
    setSelectedToppingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmAddItem() {
    if (!pickerItem) return;
    const chosenToppings: OrderLineTopping[] = toppings
      .filter((t) => selectedToppingIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, price: t.price }));
    addItemToOrder(pickerItem, chosenToppings);
    setPickerItem(null);
  }

  function changeQty(lineId: string, delta: number) {
    const next = lines
      .map((l) => (l.id === lineId ? { ...l, qty: l.qty + delta, served: delta > 0 ? false : l.served } : l))
      .filter((l) => l.qty > 0);
    updateOrderLines(orderId, next);
  }

  function removeLine(lineId: string) {
    updateOrderLines(orderId, lines.filter((l) => l.id !== lineId));
  }

  const paidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidSoFar;

  const enteredAmount = Number(amountInput);
  const legReceived = activeMethod === "cash" ? enteredAmount : null;
  const legAttributed =
    activeMethod === "cash" ? Math.min(Math.max(enteredAmount, 0), remaining) : enteredAmount;
  const legChange = activeMethod === "cash" ? Math.max(0, enteredAmount - remaining) : 0;
  const canAddLeg =
    activeMethod !== null &&
    (activeMethod === "cash"
      ? Number.isFinite(enteredAmount) && enteredAmount > 0
      : Number.isFinite(enteredAmount) && enteredAmount > 0 && enteredAmount <= remaining);

  const canConfirm = remaining === 0 && payments.length > 0;

  function openCheckout() {
    if (lines.length === 0 || !allServed) return;
    setPayments([]);
    setActiveMethod(null);
    setAmountInput("");
    setCheckoutOpen(true);
  }

  function selectMethod(method: PaymentMethod) {
    setActiveMethod(method);
    setAmountInput(method === "cash" ? "" : String(remaining));
  }

  function addLeg() {
    if (!canAddLeg || !activeMethod) return;
    const split: PaymentSplit =
      activeMethod === "cash"
        ? { method: "cash", amount: legAttributed, received: legReceived ?? undefined, change: legChange }
        : { method: activeMethod, amount: enteredAmount };
    setPayments((prev) => [...prev, split]);
    setActiveMethod(null);
    setAmountInput("");
  }

  function removeLeg(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  async function confirmCheckout() {
    if (!canConfirm) return;
    setCompleting(true);
    try {
      await completeOrder(orderId, payments);
      router.push("/");
    } finally {
      setCompleting(false);
    }
  }

  async function savePaymentEdit() {
    if (!canConfirm) return;
    setCompleting(true);
    try {
      await updateOrderPayments(orderId, payments);
      if (order.completed_at) {
        await recomputeClosingIfExists(jstDateOf(order.completed_at));
      }
      router.push("/report");
    } finally {
      setCompleting(false);
    }
  }

  async function removeTable() {
    if (!window.confirm("このテーブルを削除しますか？注文内容も失われます。")) return;
    await deleteOrder(orderId);
    router.push("/");
  }

  if (isCompleted) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pb-8">
        <div className="flex items-center justify-between">
          <Link href="/report" className="text-sm text-zinc-500">
            ← 売上に戻る
          </Link>
        </div>

        {order.is_practice && (
          <div className="rounded-xl bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-700">
            練習モードの注文です（売上に反映されません）
          </div>
        )}

        <div className="rounded-xl bg-blue-50 px-4 py-2 text-center text-xs font-semibold text-blue-700">
          会計済みの内容です。支払い方法を修正して保存できます。
        </div>

        <section className="rounded-xl bg-white p-4 shadow">
          <p className="text-sm font-semibold text-zinc-900">
            {order.table_number ? `${order.table_number}番` : "番号未設定"} ・ {order.party_size}名
          </p>
          <ul className="mt-3 divide-y divide-zinc-200">
            {lines.map((line) => (
              <li key={line.id} className="py-2">
                <p className="text-sm font-medium text-zinc-900">
                  {line.name}
                  {line.toppings.length > 0 && (
                    <span className="text-zinc-500">
                      （{line.toppings.map((t) => t.name).join("・")}）
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatYen(lineUnitPrice(line))} × {line.qty} = {formatYen(lineUnitPrice(line) * line.qty)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">お会計合計</span>
            <span className="text-xl font-bold text-zinc-900">{formatYen(total)}</span>
          </div>
          <div className="text-right text-xs text-zinc-400">
            {tax.taxable10 > 0 && <span>10%対象 {formatYen(tax.taxable10)}（内税{formatYen(tax.tax10)}）</span>}
            {tax.taxable10 > 0 && tax.taxable8 > 0 && <span> ・ </span>}
            {tax.taxable8 > 0 && <span>8%対象 {formatYen(tax.taxable8)}（内税{formatYen(tax.tax8)}）</span>}
          </div>
          <div className="text-right text-xs text-zinc-400">
            税抜合計 {formatYen(taxExcludedTotal(tax))} ・ 内税合計 {formatYen(totalTax(tax))}
          </div>

          <PaymentLegs payments={payments} onRemove={removeLeg} />

          {remaining !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">{remaining > 0 ? "残り" : "超過"}</span>
              <span className="font-semibold text-zinc-900">{formatYen(Math.abs(remaining))}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                onClick={() => selectMethod(method)}
                className={`rounded-lg py-2 text-sm font-medium ${
                  activeMethod === method ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            ))}
          </div>
          {activeMethod && (
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-semibold text-zinc-500">
                  {activeMethod === "cash" ? "預かり金額" : "金額"}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={activeMethod === "cash" ? "例: 2000" : undefined}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min={0}
                  autoFocus
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                onClick={addLeg}
                disabled={!canAddLeg}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
              >
                追加
              </button>
            </div>
          )}

          <button
            onClick={savePaymentEdit}
            disabled={!canConfirm || completing}
            className="mt-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
          >
            保存する
          </button>
        </section>
      </div>
    );
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

      {order.is_practice && (
        <div className="rounded-xl bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-700">
          練習モードの注文です（売上に反映されません）
        </div>
      )}

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
            key={`party-${orderId}`}
            type="text"
            inputMode="numeric"
            defaultValue={order.party_size}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, "");
              if (cleaned) updateOrderMeta(orderId, { party_size: Math.max(1, Number(cleaned)) });
            }}
            onBlur={(e) => {
              if (!e.target.value.replace(/[^0-9]/g, "")) {
                e.target.value = String(order.party_size);
              }
            }}
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
                      onClick={() => handleItemTap(item)}
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
              <li key={line.id} className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {line.name}
                    {line.toppings.length > 0 && (
                      <span className="text-zinc-500">
                        （{line.toppings.map((t) => t.name).join("・")}）
                      </span>
                    )}
                    {line.served ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        提供済み
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                        未提供
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatYen(lineUnitPrice(line))} × {line.qty} = {formatYen(lineUnitPrice(line) * line.qty)}
                  </p>
                </div>
                <button
                  onClick={() => changeQty(line.id, -1)}
                  className="h-8 w-8 rounded-full bg-zinc-100 text-lg font-bold text-zinc-700 active:bg-zinc-200"
                  aria-label="数量を減らす"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                <button
                  onClick={() => changeQty(line.id, 1)}
                  className="h-8 w-8 rounded-full bg-zinc-100 text-lg font-bold text-zinc-700 active:bg-zinc-200"
                  aria-label="数量を増やす"
                >
                  ＋
                </button>
                <button onClick={() => removeLine(line.id)} className="ml-1 text-xs text-red-500">
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pickerItem && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-t-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-zinc-900">{pickerItem.name}</p>
                <p className="text-sm text-zinc-500">{formatYen(pickerItem.price)}</p>
              </div>
              <button
                onClick={() => setPickerItem(null)}
                className="text-sm text-zinc-500"
              >
                キャンセル
              </button>
            </div>

            {toppings.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                <p className="text-xs font-semibold text-zinc-500">トッピング</p>
                <div className="flex flex-wrap gap-2">
                  {toppings.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => toggleTopping(t.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        selectedToppingIds.has(t.id)
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {t.name} +{formatYen(t.price)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={confirmAddItem}
              className="w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:bg-zinc-700"
            >
              追加（
              {formatYen(
                pickerItem.price +
                  toppings
                    .filter((t) => selectedToppingIds.has(t.id))
                    .reduce((sum, t) => sum + t.price, 0)
              )}
              ）
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {!checkoutOpen ? (
            <div className="flex flex-col gap-2">
              {lines.length > 0 && !allServed && (
                <p className="text-xs font-medium text-red-600">
                  未提供の商品があります（あと{unservedCount}点）。キッチン画面で提供済みにしてください。
                </p>
              )}
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
                  disabled={lines.length === 0 || !allServed}
                  className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
                >
                  会計する
                </button>
              </div>
            </div>
          ) : (
            <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">お会計合計</span>
                <span className="text-xl font-bold text-zinc-900">{formatYen(total)}</span>
              </div>
              <div className="text-right text-xs text-zinc-400">
                {tax.taxable10 > 0 && <span>10%対象 {formatYen(tax.taxable10)}（内税{formatYen(tax.tax10)}）</span>}
                {tax.taxable10 > 0 && tax.taxable8 > 0 && <span> ・ </span>}
                {tax.taxable8 > 0 && <span>8%対象 {formatYen(tax.taxable8)}（内税{formatYen(tax.tax8)}）</span>}
              </div>
              <div className="text-right text-xs text-zinc-400">
                税抜合計 {formatYen(taxExcludedTotal(tax))} ・ 内税合計 {formatYen(totalTax(tax))}
              </div>

              <PaymentLegs payments={payments} onRemove={removeLeg} />

              {remaining > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">残り</span>
                    <span className="font-semibold text-zinc-900">{formatYen(remaining)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method}
                        onClick={() => selectMethod(method)}
                        className={`rounded-lg py-2 text-sm font-medium ${
                          activeMethod === method
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {PAYMENT_METHOD_LABELS[method]}
                      </button>
                    ))}
                  </div>
                  {activeMethod && (
                    <div className="flex items-end gap-2">
                      <label className="flex-1">
                        <span className="mb-1 block text-xs font-semibold text-zinc-500">
                          {activeMethod === "cash" ? "預かり金額" : "金額"}
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder={activeMethod === "cash" ? "例: 2000" : undefined}
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          min={0}
                          autoFocus
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        />
                      </label>
                      {activeMethod === "cash" && (
                        <div className="flex-1 text-right">
                          <span className="mb-1 block text-xs font-semibold text-zinc-500">お釣り</span>
                          <span className="text-lg font-bold text-zinc-900">
                            {Number.isFinite(enteredAmount) && enteredAmount > 0
                              ? formatYen(legChange)
                              : "―"}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={addLeg}
                        disabled={!canAddLeg}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
                      >
                        追加
                      </button>
                    </div>
                  )}
                </>
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
