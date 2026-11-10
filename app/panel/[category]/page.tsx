import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BusinessPanelView } from "@/components/BusinessPanelView";
import { INDUSTRY_BY_KEY } from "@/lib/data";
import type { IndustryKey } from "@/lib/types";

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const mod = INDUSTRY_BY_KEY[params.category as IndustryKey];
  return {
    title: mod ? `${mod.label} Panel` : "Business Panel",
    description: mod?.description ?? "Business category panel",
  };
}

export default function BusinessPanelPage({ params }: { params: { category: string } }) {
  const mod = INDUSTRY_BY_KEY[params.category as IndustryKey];
  if (!mod) notFound();
  return <BusinessPanelView category={params.category} />;
}
