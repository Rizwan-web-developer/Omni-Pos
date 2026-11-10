import { StorePanel } from "@/components/store/StorePanel";
export default function StoreInventoryPage({ params }: { params: { id: string } }) {
  return <StorePanel businessId={params.id} section="inventory" />;
}
