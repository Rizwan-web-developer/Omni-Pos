import type { Metadata } from "next";

import { PharmacyPOS } from "@/components/PharmacyPOS";

export const metadata: Metadata = {
  title: "Pharmacy POS Terminal",
  description: "FEFO batch dispensing with amber expiry alerts and keyboard control.",
};

export default function PharmacyPage() {
  return <PharmacyPOS />;
}
