import { StorePanel } from "@/components/store/StorePanel";

export default function StoreOverviewPage({ params }: { params: { id: string } }) {
  return <StorePanel businessId={params.id} section="overview" />;
}
