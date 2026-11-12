import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { getTenantFlags, type TenantFlags } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";

type CartItem = { productId?: string; quantity?: number; serialItemIds?: unknown };

const PAYMENT_METHODS = new Set(["CASH", "CARD", "BANK", "OTHER"]);

function productDisplayBrand(p: any): string | null {
  const b = String(p?.brandRef?.name ?? p?.brand ?? "").trim();
  return b || null;
}

function serializeInvoice(inv: any) {
  return {
    ...inv,
    subtotalPkr: Number(inv.subtotalPkr ?? 0),
    discountPkr: Number(inv.discountPkr ?? 0),
    totalAmount: Number(inv.totalAmount),
    downPaymentPkr: Number(inv.downPaymentPkr ?? 0),
    duePkr: Number(inv.duePkr ?? 0),
    items: (inv.items ?? []).map((it: any) => ({
      ...it,
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
      productName: it.productName ?? it.product?.name ?? null,
      brandName: it.brandName ?? it.product?.brandRef?.name ?? it.product?.brand ?? null,
      imageUrl: it.imageUrl ?? it.product?.imageUrl ?? null,
    })),
  };
}

const INVOICE_INCLUDE = {
  items: {
    include: { product: { select: { name: true, brand: true, imageUrl: true, brandRef: { select: { name: true } } } } },
  },
} as const;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;

  let clientRefForRetry: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = params.id;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });
    const flags: TenantFlags = await getTenantFlags(tenantId);
    const serialEnabled = flags.SERIAL_IMEI;

    const rawItems: CartItem[] = Array.isArray(body?.items) ? (body.items as CartItem[]) : [];
    const paymentMethodRaw = String(body?.paymentMethod ?? "CASH").toUpperCase();
    const paymentMethod = PAYMENT_METHODS.has(paymentMethodRaw) ? paymentMethodRaw : "CASH";
    const customerName = String(body?.customerName ?? "").trim().slice(0, 120) || null;
    const customerPhone = String(body?.customerPhone ?? "").trim().slice(0, 40) || null;
    const prescriptionNote = String(body?.prescriptionNote ?? "").trim().slice(0, 300) || null;
    const clientRef = String(body?.clientRef ?? "").trim().slice(0, 80) || null;
    clientRefForRetry = clientRef;
    const discountPkr = Math.max(0, Number(body?.discountPkr ?? 0) || 0);
    const downPaymentInput = Math.max(0, Number(body?.downPaymentPkr ?? 0) || 0);

    if (rawItems.length === 0) return NextResponse.json({ message: "Cart is empty." }, { status: 400 });
    if (discountPkr > 0 && !flags.DISCOUNTS) {
      return NextResponse.json({ message: "Discounts are not enabled for this business. Contact the platform admin." }, { status: 403 });
    }
    if (downPaymentInput > 0 && !flags.INSTALLMENTS) {
      return NextResponse.json({ message: "Installment sales are not enabled for this business. Contact the platform admin." }, { status: 403 });
    }

    // Idempotency for offline/replayed checkouts.
    if (clientRef) {
      const prior = await (prisma as any).invoice.findFirst({
        where: { tenantId, clientRef },
        include: INVOICE_INCLUDE,
      });
      if (prior) return NextResponse.json({ invoice: serializeInvoice(prior), duplicate: true }, { status: 200 });
    }

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
        batchNumber: true, expiryDate: true, prescriptionRequired: true,
        shadeCode: true, unitLabel: true, installmentAvailable: true, serviceItem: true,
        brandRef: { select: { name: true } },
      },
    });
    if (products.length !== allProductIds.length) {
      return NextResponse.json({ message: "One or more products not found or unavailable." }, { status: 400 });
    }
    const byId = new Map<string, any>(products.map((p: any) => [p.id, p]));

    // Prescription gate: prescription-only items need the note when the feature is enabled.
    if (flags.PRESCRIPTION) {
      const needsRx = products.find((p: any) => p.prescriptionRequired);
      if (needsRx && !prescriptionNote) {
        return NextResponse.json(
          { message: `"${needsRx.name}" is a prescription product. Enter the doctor / prescription details.` },
          { status: 400 },
        );
      }
    }

    // Expired stock can never be sold (batch/expiry feature).
    if (flags.BATCH_EXPIRY) {
      const expired = products.find((p: any) => p.expiryDate && new Date(p.expiryDate).getTime() < Date.now());
      if (expired) {
        return NextResponse.json(
          { message: `"${expired.name}" has expired (${new Date(expired.expiryDate).toLocaleDateString("en-PK")}). Remove expired stock before selling.` },
          { status: 409 },
        );
      }
    }

    // Build line plan
    type PlanLine = {
      kind: "bulk" | "serial";
      productId: string;
      name: string;
      brandName: string | null;
      imageUrl: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      serialItemIds?: string[];
      batchNumber: string | null;
      expiryDate: Date | null;
      shadeCode: string | null;
      unitLabel: string | null;
      serviceItem: boolean;
    };
    const plan: PlanLine[] = [];

    for (const [pid, serialIds] of serialsByProduct.entries()) {
      const p = byId.get(pid);
      if (!p) return NextResponse.json({ message: "Product not found." }, { status: 400 });
      if (String(p.trackingType) !== "SERIAL_OR_IMEI") {
        return NextResponse.json({ message: `"${p.name}" is not serial-tracked; remove serial selection.` }, { status: 400 });
      }
      plan.push({
        kind: "serial", productId: pid, name: p.name, brandName: productDisplayBrand(p), imageUrl: p.imageUrl ?? null,
        quantity: serialIds.length, unitPrice: Number(p.sellingPrice), lineTotal: Number(p.sellingPrice) * serialIds.length,
        serialItemIds: serialIds, batchNumber: p.batchNumber ?? null, expiryDate: p.expiryDate ?? null,
        shadeCode: p.shadeCode ?? null, unitLabel: p.unitLabel ?? null, serviceItem: Boolean(p.serviceItem),
      });
    }
    for (const [pid, q] of qtyById.entries()) {
      const p = byId.get(pid);
      if (!p) return NextResponse.json({ message: "Product not found." }, { status: 400 });
      const isService = Boolean(p.serviceItem);
      if (serialEnabled && String(p.trackingType) === "SERIAL_OR_IMEI") {
        return NextResponse.json({ message: `Select the Serial/IMEI for "${p.name}" before checkout.` }, { status: 400 });
      }
      if (!isService && p.stockQuantity < q) {
        return NextResponse.json({ message: `Insufficient stock for "${p.name}" (available ${p.stockQuantity}).` }, { status: 400 });
      }
      const unitPrice = Number(p.sellingPrice);
      plan.push({
        kind: "bulk", productId: pid, name: p.name, brandName: productDisplayBrand(p), imageUrl: p.imageUrl ?? null,
        quantity: q, unitPrice, lineTotal: unitPrice * q, batchNumber: p.batchNumber ?? null,
        expiryDate: p.expiryDate ?? null, shadeCode: p.shadeCode ?? null, unitLabel: p.unitLabel ?? null,
        serviceItem: isService,
      });
    }

    const subtotal = plan.reduce((sum, line) => sum + line.lineTotal, 0);
    const effectiveDiscount = Math.min(discountPkr, subtotal);
    const totalAmount = Math.round((subtotal - effectiveDiscount) * 100) / 100;
    const downPaymentPkr = Math.min(downPaymentInput, totalAmount);
    const duePkr = Math.round((totalAmount - downPaymentPkr) * 100) / 100;

    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

    const invoice = await prisma.$transaction(async (tx: any) => {
      const itemCreates: any[] = [];

      for (const line of plan) {
        const baseItem = {
          productId: line.productId,
          productName: line.name,
          brandName: line.brandName,
          imageUrl: line.imageUrl,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          shadeCode: line.shadeCode,
          unitLabel: line.unitLabel,
        };

        if (line.kind === "bulk") {
          if (!line.serviceItem) {
            const res = await tx.product.updateMany({
              where: { id: line.productId, tenantId, stockQuantity: { gte: line.quantity } },
              data: { stockQuantity: { decrement: line.quantity } },
            });
            if (res.count !== 1) throw new Error(`Stock changed for "${line.name}". Please retry.`);
          }
          itemCreates.push({
            ...baseItem,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            serialItemId: null,
            serialOrImei: null,
          });
        } else {
          // Fetch the serials (must be unsold, belong to product+tenant)
          const serials = await tx.serialItem.findMany({
            where: { id: { in: line.serialItemIds }, productId: line.productId, tenantId, isSold: false },
            select: { id: true, serialOrImei: true },
          });
          if (serials.length !== (line.serialItemIds?.length ?? 0)) {
            throw new Error(`One or more selected Serial/IMEI for "${line.name}" are unavailable. Please reselect.`);
          }
          const soldAt = new Date();
          const upd = await tx.serialItem.updateMany({
            where: { id: { in: line.serialItemIds }, productId: line.productId, tenantId, isSold: false },
            data: { isSold: true, soldAt },
          });
          if (upd.count !== (line.serialItemIds?.length ?? 0)) {
            throw new Error(`Serial/IMEI for "${line.name}" changed during checkout. Please retry.`);
          }
          // Decrement available count by number of serials sold
          await tx.product.update({
            where: { id: line.productId },
            data: { stockQuantity: { decrement: line.serialItemIds?.length ?? 0 } },
          });
          for (const s of serials) {
            itemCreates.push({
              ...baseItem,
              quantity: 1,
              unitPrice: line.unitPrice,
              lineTotal: line.unitPrice,
              serialItemId: s.id,
              serialOrImei: s.serialOrImei,
            });
          }
        }
      }

      return tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          customerName,
          customerPhone,
          subtotalPkr: subtotal,
          discountPkr: effectiveDiscount,
          totalAmount,
          downPaymentPkr,
          duePkr,
          paymentMethod,
          prescriptionNote,
          clientRef,
          syncStatus: "SYNCED",
          items: { create: itemCreates },
        },
        include: INVOICE_INCLUDE,
      });
    });

    return NextResponse.json({ invoice: serializeInvoice(invoice) }, { status: 201 });
  } catch (error: any) {
    // Idempotent replay race: another request created the same clientRef invoice.
    if (error?.code === "P2002" && error?.meta?.target) {
      try {
        if (clientRefForRetry) {
          const prior = await (prisma as any).invoice.findFirst({
            where: { tenantId: params.id, clientRef: clientRefForRetry },
            include: INVOICE_INCLUDE,
          });
          if (prior) return NextResponse.json({ invoice: serializeInvoice(prior), duplicate: true }, { status: 200 });
        }
      } catch {
        /* fall through */
      }
    }
    console.error("Checkout error:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Checkout failed." }, { status: 500 });
  }
}
