import { StorePanel } from "@/components/store/StorePanel";
export default function StorePosPage({ params }: { params: { id: string } }) {
  return <StorePanel businessId={params.id} section="pos" />;
}
