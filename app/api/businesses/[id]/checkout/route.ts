import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";

type CartItem = { productId?: string; quantity?: number; serialItemIds?: unknown };

function productDisplayBrand(p: any): string | null {
  const b = String(p?.brandRef?.name ?? p?.brand ?? "").trim();
  return b || null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = params.id;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });
    const serialEnabled = await tenantHasFeature(tenantId, "SERIAL_IMEI");

    const rawItems: CartItem[] = Array.isArray(body?.items) ? (body.items as CartItem[]) : [];
    const paymentMethod = String(body?.paymentMethod ?? "CASH").toUpperCase();
    const customerName = String(body?.customerName ?? "").trim() || null;

    if (rawItems.length === 0) return NextResponse.json({ message: "Cart is empty." }, { status: 400 });

    // Normalize: collect requested serial IDs per product and quantity for bulk items
    const qtyById = new Map<string, number>();
    const serialsByProduct = new Map<string, string[]>();
    const allSerialIds = new Set<string>();

    for (const it of rawItems) {
      const pid = String(it?.productId ?? "").trim();
      if (!pid) continue;
      const serialIds = Array.isArray(it?.serialItemIds)
        ? (it.serialItemIds as unknown[]).map((s) => String(s ?? "").trim()).filter(Boolean)
        : [];
      if (serialIds.length > 0) {
        // Deduplicate within request
        const unique = Array.from(new Set(serialIds));
        for (const sid of unique) {
          if (allSerialIds.has(sid)) return NextResponse.json({ message: "Duplicate serial selected in cart." }, { status: 400 });
          allSerialIds.add(sid);
        }
        const prev = serialsByProduct.get(pid) ?? [];
        serialsByProduct.set(pid, [...prev, ...unique]);
      } else {
        const q = Math.max(1, Math.floor(Number(it?.quantity ?? 1)));
        qtyById.set(pid, (qtyById.get(pid) ?? 0) + q);
      }
    }

    const allProductIds = Array.from(new Set([...qtyById.keys(), ...serialsByProduct.keys()]));
    if (allProductIds.length === 0) return NextResponse.json({ message: "No valid items." }, { status: 400 });

    if (serialsByProduct.size > 0 && !serialEnabled) {
      return NextResponse.json(
        { message: "IMEI/Serial tracking is not enabled for this business. Sell these items as bulk stock instead." },
        { status: 403 },
      );
    }

    const products = await (prisma as any).product.findMany({
      where: { id: { in: allProductIds }, tenantId, deletedAt: null, isActive: true },
      select: {
        id: true, name: true, brand: true, imageUrl: true,
        sellingPrice: true, stockQuantity: true, trackingType: true,
        brandRef: { select: { name: true } },
      },
    });
    if (products.length !== allProductIds.length) {
      return NextResponse.json({ message: "One or more products not found or unavailable." }, { status: 400 });
    }
    const byId = new Map<string, any>(products.map((p: any) => [p.id, p]));

    // Build line plan
    type PlanLine =
      | { kind: "bulk"; productId: string; name: string; brandName: string | null; imageUrl: string | null; quantity: number; unitPrice: number; lineTotal: number }
      | { kind: "serial"; productId: string; name: string; brandName: string | null; imageUrl: string | null; serialItemIds: string[]; unitPrice: number };
    const plan: PlanLine[] = [];

    for (const [pid, serialIds] of serialsByProduct.entries()) {
      const p = byId.get(pid);
      if (!p) return NextResponse.json({ message: "Product not found." }, { status: 400 });
      if (String(p.trackingType) !== "SERIAL_OR_IMEI") {
        return NextResponse.json({ message: `"${p.name}" is not serial-tracked; remove serial selection.` }, { status: 400 });
      }
      plan.push({ kind: "serial", productId: pid, name: p.name, brandName: productDisplayBrand(p), imageUrl: p.imageUrl ?? null, serialItemIds: serialIds, unitPrice: Number(p.sellingPrice) });
    }
    for (const [pid, q] of qtyById.entries()) {
      const p = byId.get(pid);
      if (!p) return NextResponse.json({ message: "Product not found." }, { status: 400 });
      if (serialEnabled && String(p.trackingType) === "SERIAL_OR_IMEI") {
        return NextResponse.json({ message: `Select the Serial/IMEI for "${p.name}" before checkout.` }, { status: 400 });
      }
      if (p.stockQuantity < q) {
        return NextResponse.json({ message: `Insufficient stock for "${p.name}" (available ${p.stockQuantity}).` }, { status: 400 });
      }
      const unitPrice = Number(p.sellingPrice);
      plan.push({ kind: "bulk", productId: pid, name: p.name, brandName: productDisplayBrand(p), imageUrl: p.imageUrl ?? null, quantity: q, unitPrice, lineTotal: unitPrice * q });
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

    const invoice = await prisma.$transaction(async (tx: any) => {
      const itemCreates: any[] = [];
      let totalAmount = 0;

      for (const line of plan) {
        if (line.kind === "bulk") {
          const res = await tx.product.updateMany({
            where: { id: line.productId, tenantId, stockQuantity: { gte: line.quantity } },
            data: { stockQuantity: { decrement: line.quantity } },
          });
          if (res.count !== 1) throw new Error(`Stock changed for "${line.name}". Please retry.`);
          itemCreates.push({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            serialItemId: null,
            serialOrImei: null,
            productName: line.name,
            brandName: line.brandName,
            imageUrl: line.imageUrl,
          });
          totalAmount += line.lineTotal;
        } else {
          // Fetch the serials (must be unsold, belong to product+tenant)
          const serials = await tx.serialItem.findMany({
            where: { id: { in: line.serialItemIds }, productId: line.productId, tenantId, isSold: false },
            select: { id: true, serialOrImei: true },
          });
          if (serials.length !== line.serialItemIds.length) {
            throw new Error(`One or more selected Serial/IMEI for "${line.name}" are unavailable. Please reselect.`);
          }
          const soldAt = new Date();
          const upd = await tx.serialItem.updateMany({
            where: { id: { in: line.serialItemIds }, productId: line.productId, tenantId, isSold: false },
            data: { isSold: true, soldAt },
          });
          if (upd.count !== line.serialItemIds.length) {
            throw new Error(`Serial/IMEI for "${line.name}" changed during checkout. Please retry.`);
          }
          // Decrement available count by number of serials sold
          await tx.product.update({
            where: { id: line.productId },
            data: { stockQuantity: { decrement: line.serialItemIds.length } },
          });
          for (const s of serials) {
            itemCreates.push({
              productId: line.productId,
              quantity: 1,
              unitPrice: line.unitPrice,
              lineTotal: line.unitPrice,
              serialItemId: s.id,
              serialOrImei: s.serialOrImei,
              productName: line.name,
              brandName: line.brandName,
              imageUrl: line.imageUrl,
            });
            totalAmount += line.unitPrice;
          }
        }
      }

      return tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          customerName,
          totalAmount,
          paymentMethod,
          syncStatus: "SYNCED",
          items: { create: itemCreates },
        },
        include: {
          items: {
            include: { product: { select: { name: true, brand: true, imageUrl: true, brandRef: { select: { name: true } } } } },
          },
        },
      });
    });

    return NextResponse.json(
      {
        invoice: {
          ...invoice,
          totalAmount: Number(invoice.totalAmount),
          items: invoice.items.map((it: any) => ({
            ...it,
            unitPrice: Number(it.unitPrice),
            lineTotal: Number(it.lineTotal),
            productName: it.productName ?? it.product?.name ?? null,
            brandName: it.brandName ?? it.product?.brandRef?.name ?? it.product?.brand ?? null,
            imageUrl: it.imageUrl ?? it.product?.imageUrl ?? null,
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Checkout failed." }, { status: 500 });
  }
}
