export const CATEGORIES = ["お好み焼", "焼そば", "ネギ焼", "一品", "ソフトドリンク", "アルコール", "その他"] as const;
export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_CATEGORY: Category = "一品";

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: Category;
  sort_order: number;
};

export type OrderLine = {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
};

export type OrderStatus = "open" | "completed";

export const PAYMENT_METHODS = ["cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "現金",
  card: "カード",
  other: "その他",
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
  payment_method: PaymentMethod | null;
  received_amount: number | null;
  change_amount: number | null;
};

export type DailyClosing = {
  id: string;
  business_date: string;
  closed_at: string;
  order_count: number;
  total_sales: number;
  cash_total: number;
  card_total: number;
  other_total: number;
};
