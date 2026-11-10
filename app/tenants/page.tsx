import type { Metadata } from "next";

import { TenantsView } from "@/components/TenantsView";

export const metadata: Metadata = {
  title: "Businesses",
  description: "Create and manage businesses and their category panels.",
};

export default function TenantsPage() {
  return <TenantsView />;
}
