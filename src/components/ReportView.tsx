"use client";

import { useState } from "react";
import Link from "next/link";
import {
  INTERIM_SLOTS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type InterimSlot,
  type PaymentMethod,
} from "@/lib/types";
import {
  addTaxBreakdowns,
  computeTaxBreakdown,
  EMPTY_TAX_BREAKDOWN,
  taxExcludedTotal,
  totalTax,
} from "@/lib/useOrders";
import {
  closeDay,
  recordInterimSnapshot,
  todayJst,
  useCompletedOrders,
  useDailyClosing,
  useInterimReports,
} from "@/lib/useReport";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default function ReportView() {
  const [date, setDate] = useState(todayJst());
  const { orders, loading: ordersLoading } = useCompletedOrders(date);
  const { closing, loading: closingLoading } = useDailyClosing(date);
  const { reports: interimReports } = useInterimReports(date);
  const [closingBusy, setClosingBusy] = useState(false);
  const [recordingSlot, setRecordingSlot] = useState<InterimSlot | null>(null);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");

  async function handleRecordInterim(slot: InterimSlot) {
    setRecordingSlot(slot);
    try {
      await recordInterimSnapshot(slot);
    } finally {
      setRecordingSlot(null);
    }
  }

  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const totalGuests = orders.reduce((sum, o) => sum + o.party_size, 0);
  const totalsByMethod: Partial<Record<PaymentMethod, number>> = {};
  const countsByMethod: Partial<Record<PaymentMethod, number>> = {};
  let taxBreakdown = EMPTY_TAX_BREAKDOWN;
  for (const o of orders) {
    for (const p of o.payments) {
      totalsByMethod[p.method] = (totalsByMethod[p.method] ?? 0) + p.amount;
      countsByMethod[p.method] = (countsByMethod[p.method] ?? 0) + 1;
    }
    taxBreakdown = addTaxBreakdowns(taxBreakdown, computeTaxBreakdown(o.lines));
  }

  async function handleCloseDay() {
    if (orders.length === 0) return;
    if (!window.confirm(`${date} の閉店処理を確定します。件数: ${orders.length}件 / 合計: ${formatYen(totalSales)}\nよろしいですか？`)) return;
    setClosingBusy(true);
    try {
      await closeDay(date, orders);
    } finally {
      setClosingBusy(false);
    }
  }

  const availableMethods = PAYMENT_METHODS.filter((m) => (totalsByMethod[m] ?? 0) > 0);
  const filteredOrders =
    methodFilter === "all" ? orders : orders.filter((o) => o.payments.some((p) => p.method === methodFilter));

  const loading = ordersLoading || closingLoading;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <label className="flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-500">対象日</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : (
        <>
          <section className="rounded-xl bg-white p-4 shadow">
            {closing ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-emerald-600">
                  精算済み（{new Date(closing.closed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）
                </p>
                <p className="text-3xl font-bold text-zinc-900">
                  {formatYen(taxExcludedTotal(closing.tax_breakdown ?? EMPTY_TAX_BREAKDOWN))}
                </p>
                <p className="text-xs text-zinc-500">税込 {formatYen(closing.total_sales)}</p>
                <p className="text-xs text-zinc-500">
                  {closing.order_count}組 ・ {closing.total_guests ?? 0}名
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  {(Object.entries(closing.totals_by_method) as [PaymentMethod, number][])
                    .filter(([, amount]) => amount > 0)
                    .map(([method, amount]) => (
                      <div key={method}>
                        <p className="text-xs text-zinc-500">
                          {PAYMENT_METHOD_LABELS[method]}（{closing.counts_by_method?.[method] ?? 0}件）
                        </p>
                        <p className="font-semibold">{formatYen(amount)}</p>
                      </div>
                    ))}
                </div>
                <div className="mt-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
                  内消費税　10%対象 {formatYen(closing.tax_breakdown?.taxable10 ?? 0)}（税
                  {formatYen(closing.tax_breakdown?.tax10 ?? 0)}） ・ 8%対象{" "}
                  {formatYen(closing.tax_breakdown?.taxable8 ?? 0)}（税{formatYen(closing.tax_breakdown?.tax8 ?? 0)}）
                </div>
                <div className="text-xs text-zinc-500">
                  内税合計　{formatYen(totalTax(closing.tax_breakdown ?? EMPTY_TAX_BREAKDOWN))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-zinc-500">未精算（{date}の集計）</p>
                <p className="text-3xl font-bold text-zinc-900">{formatYen(taxExcludedTotal(taxBreakdown))}</p>
                <p className="text-xs text-zinc-500">税込 {formatYen(totalSales)}</p>
                <p className="text-xs text-zinc-500">
                  {orders.length}組 ・ {totalGuests}名
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  {(Object.entries(totalsByMethod) as [PaymentMethod, number][])
                    .filter(([, amount]) => amount > 0)
                    .map(([method, amount]) => (
                      <div key={method}>
                        <p className="text-xs text-zinc-500">
                          {PAYMENT_METHOD_LABELS[method]}（{countsByMethod[method] ?? 0}件）
                        </p>
                        <p className="font-semibold">{formatYen(amount)}</p>
                      </div>
                    ))}
                </div>
                <div className="mt-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
                  内消費税　10%対象 {formatYen(taxBreakdown.taxable10)}（税{formatYen(taxBreakdown.tax10)}） ・
                  8%対象 {formatYen(taxBreakdown.taxable8)}（税{formatYen(taxBreakdown.tax8)}）
                </div>
                <div className="text-xs text-zinc-500">内税合計　{formatYen(totalTax(taxBreakdown))}</div>
                <button
                  onClick={handleCloseDay}
                  disabled={orders.length === 0 || closingBusy}
                  className="mt-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:bg-zinc-700 disabled:opacity-40"
                >
                  閉店処理を確定
                </button>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">中間計</h2>
            <ul className="flex flex-col gap-2">
              {INTERIM_SLOTS.map((slot) => {
                const report = interimReports.find((r) => r.slot === slot);
                return (
                  <li key={slot} className="rounded-xl bg-white p-3 shadow">
                    {report ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-900">{slot}時点</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">{formatTime(report.recorded_at)}記録</span>
                            <button
                              onClick={() => handleRecordInterim(slot)}
                              disabled={recordingSlot === slot}
                              className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 active:bg-zinc-100 disabled:opacity-40"
                            >
                              更新
                            </button>
                          </div>
                        </div>
                        <p className="text-xl font-bold text-zinc-900">
                          {formatYen(taxExcludedTotal(report.tax_breakdown ?? EMPTY_TAX_BREAKDOWN))}
                        </p>
                        <p className="text-xs text-zinc-500">
                          税込 {formatYen(report.total_sales)} ・ {report.order_count}組 ・ {report.total_guests}名
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                          {(Object.entries(report.totals_by_method) as [PaymentMethod, number][])
                            .filter(([, amount]) => amount > 0)
                            .map(([method, amount]) => (
                              <span key={method}>
                                {PAYMENT_METHOD_LABELS[method]}（{report.counts_by_method?.[method] ?? 0}件）
                                {formatYen(amount)}
                              </span>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">{slot}時点 ・ 未記録</span>
                        <button
                          onClick={() => handleRecordInterim(slot)}
                          disabled={recordingSlot === slot}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 active:bg-zinc-100 disabled:opacity-40"
                        >
                          今すぐ記録
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">会計履歴</h2>
            {orders.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setMethodFilter("all")}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                    methodFilter === "all" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 shadow"
                  }`}
                >
                  すべて
                </button>
                {availableMethods.map((method) => (
                  <button
                    key={method}
                    onClick={() => setMethodFilter(method)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                      methodFilter === method ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 shadow"
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
            )}
            {orders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                この日の会計履歴はありません。
              </p>
            ) : filteredOrders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                この条件に一致する会計履歴はありません。
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 rounded-xl bg-white shadow">
                {filteredOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/order/${o.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 active:bg-zinc-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {o.table_number ? `${o.table_number}番` : "番号未設定"} ・ {o.party_size}名
                        </p>
                        <p className="text-xs text-zinc-500">
                          {o.completed_at && formatTime(o.completed_at)} ・{" "}
                          {o.payments.length > 0
                            ? o.payments
                                .map((p) => `${PAYMENT_METHOD_LABELS[p.method]} ${formatYen(p.amount)}`)
                                .join(" + ")
                            : "―"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900">{formatYen(o.total)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
