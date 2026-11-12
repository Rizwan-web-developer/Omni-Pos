"use client";

import { StorePanel } from "@/components/store/StorePanel";

/**
 * MobilePOS — Hybrid POS / Billing screen for the Mobile Accessories & Gadgets module.
 *
 * This component renders the store POS experience for a business and implements the
 * "Hybrid Inventory Model" behaviors specified for MNI POS:
 *
 * 1) Bulk / Non-Serialized items (QUANTITY_ONLY: cables, covers, tempered glass, etc.)
 *    - Added to cart with +1 quantity increments.
 *    - Checkout deducts stockQuantity directly (no serial prompt).
 *
 * 2) High-Value / Serialized items (SERIAL_OR_IMEI: smartwatches, AirPods, phones, etc.)
 *    - Clicking the product opens a rapid Serial/IMEI selection modal listing available
 *      (unsold) tags for that product. Cashier selects or scans/types the exact tag
 *      (Enter selects an exact/unique match) to lock that unit into the cart.
 *    - Each cart line is locked to a specific serial/IMEI (anti-theft & warranty).
 *
 * 3) Checkout (atomic, server-side via POST /api/businesses/:id/checkout, $transaction)
 *    - QUANTITY_ONLY: decrements Product.stockQuantity.
 *    - SERIAL_OR_IMEI: marks selected SerialItem rows isSold=true with soldAt timestamp
 *      and decrements the available count; records serial/IMEI on InvoiceItem.
 *
 * 4) Receipt / last sale display
 *    - Itemized lines show product, quantity and, for serialized units, the Serial/IMEI
 *      number (printed for customer warranty verification). Sales/Invoices views also
 *      include serial/IMEI.
 *
 * Search supports name, category, brand, SKU/barcode and Serial/IMEI.
 * Styling follows the app's slate light/dark theme tokens (line/surface/accent).
 */
export function MobilePOS({ businessId }: { businessId: string }) {
  return <StorePanel businessId={businessId} section="pos" />;
}
