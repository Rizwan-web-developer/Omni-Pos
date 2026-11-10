import { StorePanel } from "@/components/store/StorePanel";
export default function StoreSalesPage({ params }: { params: { id: string } }) {
  return <StorePanel businessId={params.id} section="sales" />;
}
