import type { OrderLine, OrderLineTopping, TaxBreakdown } from "./types";

export function lineUnitPrice(line: OrderLine) {
  return line.price + line.toppings.reduce((sum, t) => sum + t.price, 0);
}

export function orderTotal(lines: OrderLine[]) {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.qty, 0);
}

export function sameToppingSet(a: OrderLineTopping[], b: OrderLineTopping[]) {
  if (a.length !== b.length) return false;
  const aIds = new Set(a.map((t) => t.id));
  return b.every((t) => aIds.has(t.id));
}

export function mergeOrderLines(lineGroups: OrderLine[][]): OrderLine[] {
  const merged: OrderLine[] = [];
  for (const lines of lineGroups) {
    for (const line of lines) {
      const existing = merged.find(
        (m) => m.menuItemId === line.menuItemId && sameToppingSet(m.toppings, line.toppings)
      );
      if (existing) {
        existing.qty += line.qty;
      } else {
        merged.push({ ...line, id: crypto.randomUUID() });
      }
    }
  }
  return merged;
}

export function computeTaxBreakdown(lines: OrderLine[]): TaxBreakdown {
  let taxable8 = 0;
  let taxable10 = 0;
  for (const line of lines) {
    const amount = lineUnitPrice(line) * line.qty;
    if (line.taxRate === 0.08) taxable8 += amount;
    else taxable10 += amount;
  }
  return {
    taxable8,
    tax8: Math.round((taxable8 * 8) / 108),
    taxable10,
    tax10: Math.round((taxable10 * 10) / 110),
  };
}

export function addTaxBreakdowns(a: TaxBreakdown, b: TaxBreakdown): TaxBreakdown {
  return {
    taxable8: a.taxable8 + b.taxable8,
    tax8: a.tax8 + b.tax8,
    taxable10: a.taxable10 + b.taxable10,
    tax10: a.tax10 + b.tax10,
  };
}

export const EMPTY_TAX_BREAKDOWN: TaxBreakdown = { taxable8: 0, tax8: 0, taxable10: 0, tax10: 0 };

export function taxExcludedTotal(breakdown: TaxBreakdown) {
  return breakdown.taxable8 - breakdown.tax8 + (breakdown.taxable10 - breakdown.tax10);
}

export function totalTax(breakdown: TaxBreakdown) {
  return breakdown.tax8 + breakdown.tax10;
}
