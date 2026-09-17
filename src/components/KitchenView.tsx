"use client";

import type { Order } from "@/lib/types";
import { usePracticeMode } from "@/lib/practiceMode";
import { updateOrderLines, useOpenOrders } from "@/lib/useOrders";

function toggleServed(order: Order, lineId: string) {
  const next = order.lines.map((l) => (l.id === lineId ? { ...l, served: !l.served } : l));
  updateOrderLines(order.id, next);
}

export default function KitchenView() {
  const practiceMode = usePracticeMode();
  const { orders, loading } = useOpenOrders(practiceMode);
  const ticketed = orders.filter((o) => o.lines.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-500">
          キッチン ー 通った順{practiceMode && "（練習）"}
        </h2>
        <span className="text-xs text-zinc-400">商品をタップで提供済みに</span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : ticketed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
          進行中の注文はありません。
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {ticketed.map((order) => {
            const totalCount = order.lines.length;
            const doneCount = order.lines.filter((l) => l.served).length;
            const allDone = doneCount === totalCount;
            const time = new Date(order.created_at).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Tokyo",
            });

            return (
              <div
                key={order.id}
                className={`rounded-2xl bg-white p-4 shadow ${allDone ? "opacity-50 ring-1 ring-emerald-200" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-zinc-900">
                      {order.table_number ? `${order.table_number}番` : "番号未設定"}
                    </span>
                    <span className="text-xs text-zinc-400">{time}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      allDone ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {allDone ? "提供完了" : `${doneCount}/${totalCount}`}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {order.lines.map((line) => (
                    <button
                      key={line.id}
                      onClick={() => toggleServed(order, line.id)}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${
                        line.served ? "bg-zinc-100" : "bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          line.served ? "bg-zinc-900 text-white" : "border-2 border-zinc-300"
                        }`}
                      >
                        {line.served && "✓"}
                      </span>
                      <span
                        className={`text-sm ${
                          line.served ? "text-zinc-400 line-through" : "font-medium text-zinc-900"
                        }`}
                      >
                        {line.name}
                        {line.toppings.length > 0 && `（${line.toppings.map((t) => t.name).join("・")}）`} ×{" "}
                        {line.qty}
                      </span>
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  {doneCount} / {totalCount} 提供済み
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
