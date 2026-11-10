import type { Metadata } from "next";

import { MobileAccessoriesPOS } from "@/components/MobileAccessoriesPOS";

export const metadata: Metadata = {
  title: "Mobile & IMEI Terminal",
  description: "Serialised mobile accessory checkout with GSMA IMEI validation.",
};

export default function MobileAccessoriesPage() {
  return <MobileAccessoriesPOS />;
}
