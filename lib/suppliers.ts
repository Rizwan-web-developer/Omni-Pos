import { prisma } from "@/lib/db";

/** Round to 2 decimals for money values. */
export function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export type ProductSalesStat = { soldQuantity: number; revenue: number };

export function serializeEntry(entry: any) {
  const type = entry.type === "PAYMENT" ? "PAYMENT" : "PURCHASE";
  const amount = Number(entry.amountPkr ?? 0);
  const paid = Number(entry.paidAmount ?? 0);
  return {
    ...entry,
    type,
    amountPkr: money(amount),
    unitCost: entry.unitCost == null ? null : money(Number(entry.unitCost)),
    quantity: entry.quantity == null ? null : Number(entry.quantity),
    paidAmount: money(paid),
    // For a purchase bill: how much is still owed on that bill.
    remainingPkr: type === "PURCHASE" ? money(Math.max(0, amount - paid)) : 0,
    isPaid: type === "PURCHASE" ? paid >= amount && amount > 0 : true,
  };
}

export function serializeSupplier(supplier: any, stats?: Map<string, ProductSalesStat>) {
  const entries = (supplier.entries ?? []).map(serializeEntry);

  const purchases = entries
    .filter((e: any) => e.type === "PURCHASE")
    .reduce((sum: number, e: any) => sum + e.amountPkr, 0);
  const billPaid = entries
    .filter((e: any) => e.type === "PURCHASE")
    .reduce((sum: number, e: any) => sum + e.paidAmount, 0);
  const laterPayments = entries
    .filter((e: any) => e.type === "PAYMENT")
    .reduce((sum: number, e: any) => sum + e.amountPkr, 0);
  const payments = billPaid + laterPayments;

  const products = (supplier.products ?? []).map((p: any) => {
    const stat = stats?.get(p.id);
    return {
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl ?? null,
      category: p.category ?? "",
      stockQuantity: Number(p.stockQuantity ?? 0),
      costPrice: money(Number(p.costPrice ?? 0)),
      sellingPrice: money(Number(p.sellingPrice ?? 0)),
      soldQuantity: Number(stat?.soldQuantity ?? 0),
      revenue: money(Number(stat?.revenue ?? 0)),
    };
  });

  return {
    ...supplier,
    imageUrl: supplier.imageUrl ?? null,
    entries,
    products,
    purchasesPkr: money(purchases),
    paymentsPkr: money(payments),
    balancePkr: money(Math.max(0, purchases - payments)),
    productsSoldQuantity: products.reduce((s: number, p: any) => s + p.soldQuantity, 0),
    productsRevenue: money(products.reduce((s: number, p: any) => s + p.revenue, 0)),
  };
}

/**
 * Sold quantity + revenue for a set of products, taken from real invoice lines.
 * Used to show how much of a supplier's stock has been sold and how much
 * revenue that stock generated.
 */
export async function productSalesStats(tenantId: string, productIds: string[]): Promise<Map<string, ProductSalesStat>> {
  const map = new Map<string, ProductSalesStat>();
  if (!productIds.length) return map;

  const rows: any[] = await (prisma as any).invoiceItem.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, invoice: { tenantId } },
    _sum: { quantity: true, lineTotal: true },
  });

  for (const row of rows) {
    map.set(row.productId, {
      soldQuantity: Number(row._sum?.quantity ?? 0),
      revenue: Number(row._sum?.lineTotal ?? 0),
    });
  }
  return map;
}

/** Load suppliers with their ledger entries + linked products. */
export async function loadSuppliers(tenantId: string) {
  const suppliers: any[] = await (prisma as any).supplier.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      entries: { orderBy: { createdAt: "desc" }, take: 300 },
      products: { where: { deletedAt: null }, orderBy: { name: "asc" } },
    },
  });

  const productIds = suppliers.flatMap((s) => (s.products ?? []).map((p: any) => p.id));
  const stats = await productSalesStats(tenantId, productIds);

  return suppliers.map((s) => serializeSupplier(s, stats));
}
