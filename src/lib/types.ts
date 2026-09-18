export const CATEGORIES = [
  "お好み焼",
  "焼そば",
  "ネギ焼",
  "テイクアウト",
  "一品",
  "ソフトドリンク",
  "アルコール",
  "ビール",
  "ハイボール",
  "サワー",
  "その他",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TOPPING_CATEGORIES: ReadonlySet<Category> = new Set(["お好み焼", "焼そば", "ネギ焼", "テイクアウト"]);

export const DEFAULT_CATEGORY: Category = "一品";

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: Category;
  sort_order: number;
};

export type Topping = {
  id: string;
  name: string;
  price: number;
  sort_order: number;
};

export type OrderLineTopping = {
  id: string;
  name: string;
  price: number;
};

export type OrderLine = {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  toppings: OrderLineTopping[];
  taxRate: number;
};

export const TAKEOUT_TAX_RATE = 0.08;
export const STANDARD_TAX_RATE = 0.1;

export function taxRateForCategory(category: Category): number {
  return category === "テイクアウト" ? TAKEOUT_TAX_RATE : STANDARD_TAX_RATE;
}

export type TaxBreakdown = {
  taxable8: number;
  tax8: number;
  taxable10: number;
  tax10: number;
};

export type OrderStatus = "open" | "completed";

export const PAYMENT_METHODS = [
  "cash",
  "credit",
  "qr",
  "pitapa",
  "dpay",
  "other",
  "premium",
  "chikagai",
  "gift",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "現金",
  credit: "クレジット",
  qr: "QR決済",
  pitapa: "PiTaPa",
  dpay: "d払い",
  other: "その他",
  premium: "プレミアム",
  chikagai: "地下街",
  gift: "金券",
};

export type PaymentSplit = {
  method: PaymentMethod;
  amount: number;
  received?: number;
  change?: number;
};

export type Order = {
  id: string;
  table_number: string;
  party_size: number;
  status: OrderStatus;
  lines: OrderLine[];
  total: number;
  created_at: string;
  completed_at: string | null;
  payments: PaymentSplit[];
  is_practice: boolean;
};

export type DailyClosing = {
  id: string;
  business_date: string;
  closed_at: string;
  order_count: number;
  total_guests: number;
  total_sales: number;
  totals_by_method: Partial<Record<PaymentMethod, number>>;
  tax_breakdown: TaxBreakdown;
};
