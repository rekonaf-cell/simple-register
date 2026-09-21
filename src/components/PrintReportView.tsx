"use client";

import { useSearchParams } from "next/navigation";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { taxExcludedTotal, totalTax } from "@/lib/useOrders";
import {
  creditTotals,
  summarizeOrders,
  todayJst,
  useCompletedOrders,
  useDailyClosing,
} from "@/lib/useReport";
import { SHOP_NAME } from "@/lib/shopInfo";
import styles from "@/app/report/print/print.module.css";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateJp(businessDate: string) {
  const [y, m, d] = businessDate.split("-").map(Number);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${businessDate}T00:00:00+09:00`).getDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
}

export default function PrintReportView() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? todayJst();

  const { orders, loading: ordersLoading } = useCompletedOrders(date);
  const { closing, loading: closingLoading } = useDailyClosing(date);
  const loading = ordersLoading || closingLoading;

  const summary = closing
    ? {
        total_sales: closing.total_sales,
        total_guests: closing.total_guests,
        order_count: closing.order_count,
        totals_by_method: closing.totals_by_method,
        counts_by_method: closing.counts_by_method,
        tax_breakdown: closing.tax_breakdown,
      }
    : summarizeOrders(orders);

  const methodRows = PAYMENT_METHODS.filter((m) => (summary.totals_by_method[m as PaymentMethod] ?? 0) > 0);
  const credit = creditTotals(summary.totals_by_method);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700&family=Noto+Sans+JP:wght@400;500;600;700&family=Shippori+Mincho:wght@400;500;600;700;800&display=swap"
      />
      <div className={styles.screen}>
        <div className={`${styles.toolbar} ${styles.noPrint}`}>
          <span className={styles.toolbarText}>
            {loading ? "読み込み中..." : `${date} の日計表プレビュー`}
          </span>
          <button onClick={() => window.print()} className={styles.printButton} disabled={loading}>
            印刷 / PDF保存
          </button>
        </div>

        <div className={styles.paper}>
          <div className={styles.head}>
            <div>
              <div className={styles.docTitle}>日　計　表</div>
              <div className={styles.shopline}>
                {SHOP_NAME}　／　対象日：{formatDateJp(date)}
              </div>
            </div>
            <div className={styles.stamp}>確認印</div>
          </div>

          <div className={styles.grid}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>税込売上合計</div>
              <div className={styles.cellValue}>{formatYen(summary.total_sales)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>税抜売上合計</div>
              <div className={styles.cellValue}>{formatYen(taxExcludedTotal(summary.tax_breakdown))}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>会計件数</div>
              <div className={styles.cellValue}>{summary.order_count}　組</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>来店人数</div>
              <div className={styles.cellValue}>{summary.total_guests}　名</div>
            </div>
          </div>

          <table className={styles.table}>
            <caption>支払方法内訳</caption>
            <thead>
              <tr>
                <th>方法</th>
                <th className={styles.num}>件数</th>
                <th className={styles.num}>金額</th>
              </tr>
            </thead>
            <tbody>
              {methodRows.length === 0 ? (
                <tr>
                  <td colSpan={3}>データがありません</td>
                </tr>
              ) : (
                methodRows.map((method) => (
                  <tr key={method}>
                    <td>{PAYMENT_METHOD_LABELS[method]}</td>
                    <td className={styles.num}>{summary.counts_by_method[method] ?? 0}件</td>
                    <td className={styles.num}>{formatYen(summary.totals_by_method[method] ?? 0)}</td>
                  </tr>
                ))
              )}
              <tr>
                <th>総クレジット</th>
                <td className={styles.num} colSpan={2}>
                  {formatYen(credit.total)}
                </td>
              </tr>
            </tbody>
          </table>

          <table className={styles.table}>
            <caption>消費税内訳</caption>
            <tbody>
              <tr>
                <th>10％対象</th>
                <td className={styles.num}>{formatYen(summary.tax_breakdown.taxable10)}</td>
                <th>内消費税</th>
                <td className={styles.num}>{formatYen(summary.tax_breakdown.tax10)}</td>
              </tr>
              <tr>
                <th>8％対象</th>
                <td className={styles.num}>{formatYen(summary.tax_breakdown.taxable8)}</td>
                <th>内消費税</th>
                <td className={styles.num}>{formatYen(summary.tax_breakdown.tax8)}</td>
              </tr>
              <tr>
                <th>内税合計</th>
                <td className={styles.num} colSpan={3}>
                  {formatYen(totalTax(summary.tax_breakdown))}
                </td>
              </tr>
            </tbody>
          </table>

          <div className={styles.notebox}>
            <div className={styles.noteboxLabel}>備考</div>
            <div className={styles.noteboxLines} />
          </div>

          <div className={styles.foot}>
            <div className={styles.sign}>
              <div>
                店長確認
                <div className={styles.signBox} />
              </div>
              <div>
                経理確認
                <div className={styles.signBox} />
              </div>
            </div>
            <div>
              <span suppressHydrationWarning>
                発行：簡易レジ　{new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
