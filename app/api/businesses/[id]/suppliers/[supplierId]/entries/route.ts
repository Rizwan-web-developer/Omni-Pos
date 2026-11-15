import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";
import { money, serializeEntry } from "@/lib/suppliers";

const TYPE_SET = new Set(["PURCHASE", "PAYMENT"]);

async function guard(id: string) {
  const access = await requireTenantAccess(id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(id, { adminBypass: access.admin });
  if (blocked) return blocked;
  if (!(await tenantHasFeature(id, "SUPPLIER_LEDGER"))) {
    return NextResponse.json({ message: "Supplier ledger is not enabled for this business." }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const supplier = await prisma.supplier.findFirst({ where: { id: params.supplierId, tenantId: params.id }, select: { id: true } });
    if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const typeRaw = String(body?.type ?? "PURCHASE").toUpperCase();
    if (!TYPE_SET.has(typeRaw)) return NextResponse.json({ message: "Invalid entry type." }, { status: 400 });
    const note = String(body?.note ?? "").trim().slice(0, 300) || null;

    if (typeRaw === "PAYMENT") {
      const amount = Number(body?.amountPkr ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ message: "A valid payment amount is required." }, { status: 400 });
      }
      const entry = await prisma.supplierEntry.create({
        data: {
          tenantId: params.id,
          supplierId: params.supplierId,
          type: "PAYMENT",
          amountPkr: money(amount),
          note,
        },
      });
      return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
    }

    // ---- PURCHASE / STOCK ENTRY ----
    function parseSerials(input: unknown): string[] {
      const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\n,;\s]+/) : [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const v of raw) {
        const s = String(v ?? "").trim();
        if (!s) continue;
        if (s.length < 4 || s.length > 40) continue;
        if (!/^[A-Za-z0-9\-]+$/.test(s)) continue;
        const key = s.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(s);
      }
      return out;
    }

    const serials = parseSerials(body?.serials);
    let quantity = Math.floor(Number(body?.quantity ?? 0));
    const unitCost = Number(body?.unitCost ?? 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return NextResponse.json({ message: "Enter a valid purchase price (unit cost)." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      let product: any = null;
      let createdNew = false;

      if (typeof body?.productId === "string" && body.productId.trim()) {
        product = await tx.product.findFirst({
          where: { id: body.productId.trim(), tenantId: params.id, deletedAt: null },
        });
        if (!product) throw new Error("PRODUCT_NOT_FOUND");
      } else {
        const np = body?.newProduct ?? {};
        const newName = String(np?.name ?? "").trim().slice(0, 160);
        if (newName.length < 2) throw new Error("PRODUCT_NAME_REQUIRED");
        const sellingPrice = Number(np?.sellingPrice ?? 0);
        if (!Number.isFinite(sellingPrice) || sellingPrice < 0) throw new Error("PRODUCT_PRICE_INVALID");
        const trackingType = serials.length > 0 ? "SERIAL_OR_IMEI" : "QUANTITY_ONLY";
        if (trackingType === "SERIAL_OR_IMEI" && serials.length === 0) throw new Error("SERIALS_REQUIRED");

        let categoryId: string | null = null;
        let categoryName = "";
        if (typeof np?.categoryId === "string" && np.categoryId.trim()) {
          const cat = await tx.category.findFirst({ where: { id: np.categoryId.trim(), tenantId: params.id }, select: { id: true, name: true } });
          if (cat) { categoryId = cat.id; categoryName = cat.name; }
        }
        let brandId: string | null = null;
        let brandName: string | null = null;
        if (typeof np?.brandId === "string" && np.brandId.trim()) {
          const brand = await tx.brand.findFirst({ where: { id: np.brandId.trim(), tenantId: params.id }, select: { id: true, name: true } });
          if (brand) { brandId = brand.id; brandName = brand.name; }
        }

        product = await tx.product.create({
          data: {
            tenantId: params.id,
            name: newName,
            category: categoryName,
            categoryId,
            brand: brandName,
            brandId,
            imageUrl: typeof np?.imageUrl === "string" && np.imageUrl ? np.imageUrl : null,
            trackingType,
            costPrice: money(unitCost),
            sellingPrice,
            stockQuantity: serials.length > 0 ? serials.length : quantity,
            minStockAlert: 5,
            supplierId: params.supplierId,
          },
        });
        createdNew = true;
      }

      const isSerialized = product.trackingType === "SERIAL_OR_IMEI";
      if (isSerialized) {
        if (serials.length === 0) throw new Error("SERIALS_REQUIRED");
        const conflicts = await tx.serialItem.findMany({ where: { serialOrImei: { in: serials } }, select: { serialOrImei: true } });
        if (conflicts.length > 0) throw new Error("SERIALS_CONFLICT:" + conflicts.map((c: any) => c.serialOrImei).slice(0, 5).join(", "));
        quantity = serials.length;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("QTY_REQUIRED");

      if (product) {
        const data: Record<string, unknown> = { supplierId: params.supplierId, costPrice: money(unitCost) };
        const sp = body?.sellingPrice;
        if (sp !== undefined && sp !== null && sp !== "") {
          const n = Number(sp);
          if (Number.isFinite(n) && n >= 0) data.sellingPrice = n;
        } else if (body?.newProduct && body.newProduct.sellingPrice !== undefined) {
          // already set on create
        }
        if (isSerialized) {
          // available count = current unsold + new serials
          data.stockQuantity = Number(product.stockQuantity ?? 0) + serials.length;
        } else {
          data.stockQuantity = Number(product.stockQuantity ?? 0) + (createdNew ? 0 : quantity);
        }
        // if createdNew for quantity-only we set stock at create; avoid double-add
        if (createdNew && !isSerialized) delete (data as any).stockQuantity;
        product = await tx.product.update({ where: { id: product.id }, data });
        if (isSerialized && serials.length > 0) {
          await tx.serialItem.createMany({
            data: serials.map((serialOrImei) => ({
              tenantId: params.id,
              productId: product.id,
              serialOrImei,
              isSold: false,
              warrantyDays: 0,
            })),
          });
        }
      }

      const total = money(quantity * unitCost);
      let paidNow = Number(body?.paidNow ?? 0);
      if (!Number.isFinite(paidNow) || paidNow < 0) paidNow = 0;
      paidNow = money(Math.min(paidNow, total));

      const entry = await tx.supplierEntry.create({
        data: {
          tenantId: params.id,
          supplierId: params.supplierId,
          type: "PURCHASE",
          amountPkr: total,
          productId: product?.id ?? null,
          productName: product?.name ?? null,
          quantity,
          unitCost: money(unitCost),
          paidAmount: paidNow,
          note,
        },
      });

      return { entry, product };
    });

    return NextResponse.json({ entry: serializeEntry(result.entry), product: result.product }, { status: 201 });
  } catch (error: any) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PRODUCT_NOT_FOUND") return NextResponse.json({ message: "Selected product was not found." }, { status: 400 });
    if (code === "PRODUCT_NAME_REQUIRED") return NextResponse.json({ message: "Enter a name for the new product." }, { status: 400 });
    if (code === "PRODUCT_PRICE_INVALID") return NextResponse.json({ message: "Enter a valid selling price for the new product." }, { status: 400 });
    if (code === "QTY_REQUIRED") return NextResponse.json({ message: "Enter a quantity of 1 or more." }, { status: 400 });
    if (code === "SERIALS_REQUIRED") return NextResponse.json({ message: "Add at least one Serial/IMEI for this product." }, { status: 400 });
    if (typeof code === "string" && code.startsWith("SERIALS_CONFLICT:")) return NextResponse.json({ message: `These Serial/IMEI already exist: ${code.slice(16)}` }, { status: 409 });
    console.error("Create supplier entry error:", error);
    return NextResponse.json({ message: "Failed to add supplier entry." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const url = new URL(req.url);
    const entryId = url.searchParams.get("entryId") ?? "";
    if (!entryId) return NextResponse.json({ message: "Entry id is required." }, { status: 400 });

    const entry: any = await prisma.supplierEntry.findFirst({
      where: { id: entryId, supplierId: params.supplierId, tenantId: params.id },
    });
    if (!entry) return NextResponse.json({ message: "Entry not found." }, { status: 404 });

    await prisma.$transaction(async (tx: any) => {
      // Deleting a purchase bill also takes that stock back out of inventory.
      if (entry.type === "PURCHASE" && entry.productId && entry.quantity) {
        const product = await tx.product.findFirst({ where: { id: entry.productId, tenantId: params.id }, select: { id: true, trackingType: true, stockQuantity: true } });
        if (product && product.trackingType !== "SERIAL_OR_IMEI") {
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: Math.max(0, Number(product.stockQuantity ?? 0) - Number(entry.quantity)) },
          });
        }
      }
      await tx.supplierEntry.delete({ where: { id: entryId } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete supplier entry error:", error);
    return NextResponse.json({ message: "Failed to delete supplier entry." }, { status: 500 });
  }
}
