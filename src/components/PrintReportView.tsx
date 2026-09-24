"use client";

import { useSearchParams } from "next/navigation";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { taxExcludedTotal, totalTax } from "@/lib/useOrders";
import {
  creditTotals,
  summarizeOrders,
  thisMonthJst,
  todayJst,
  useCompletedOrders,
  useDailyClosing,
  useMonthlyOrders,
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

function formatMonthJp(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${y}年${m}月`;
}

export default function PrintReportView() {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  const isMonthly = monthParam !== null;
  const date = searchParams.get("date") ?? todayJst();
  const month = monthParam ?? thisMonthJst();

  const { orders: dayOrders, loading: dayOrdersLoading } = useCompletedOrders(date);
  const { closing, loading: closingLoading } = useDailyClosing(date);
  const { orders: monthOrders, loading: monthOrdersLoading } = useMonthlyOrders(month);
  const loading = isMonthly ? monthOrdersLoading : dayOrdersLoading || closingLoading;

  const summary = isMonthly
    ? summarizeOrders(monthOrders)
    : closing
      ? {
          total_sales: closing.total_sales,
          total_guests: closing.total_guests,
          order_count: closing.order_count,
          totals_by_method: closing.totals_by_method,
          counts_by_method: closing.counts_by_method,
          tax_breakdown: closing.tax_breakdown,
        }
      : summarizeOrders(dayOrders);

  const methodRows = PAYMENT_METHODS.filter((m) => (summary.totals_by_method[m as PaymentMethod] ?? 0) > 0);
  const credit = creditTotals(summary.totals_by_method);

  const docTitle = isMonthly ? "月　計　表" : "日　計　表";
  const periodLabel = isMonthly ? `対象月：${formatMonthJp(month)}` : `対象日：${formatDateJp(date)}`;
  const previewLabel = isMonthly ? `${month} の月計表プレビュー` : `${date} の日計表プレビュー`;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700&family=Noto+Sans+JP:wght@400;500;600;700&family=Shippori+Mincho:wght@400;500;600;700;800&display=swap"
      />
      <div className={styles.screen}>
        <div className={`${styles.toolbar} ${styles.noPrint}`}>
          <span className={styles.toolbarText}>{loading ? "読み込み中..." : previewLabel}</span>
          <button onClick={() => window.print()} className={styles.printButton} disabled={loading}>
            印刷 / PDF保存
          </button>
        </div>

        <div className={styles.paper}>
          <div className={styles.head}>
            <div>
              <div className={styles.docTitle}>{docTitle}</div>
              <div className={styles.shopline}>
                {SHOP_NAME}　／　{periodLabel}
              </div>
            </div>
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
        </div>
      </div>
    </>
  );
}
