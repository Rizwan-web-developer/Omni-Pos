import type { Metadata } from "next";

import { AccessView } from "@/components/AccessView";

export const metadata: Metadata = {
  title: "Access control",
  description: "Grant or remove industry features per business.",
};

export default function AccessPage() {
  return <AccessView />;
}
