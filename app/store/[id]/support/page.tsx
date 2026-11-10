import { StoreSupport } from "@/components/store/StoreSupport";
export default function StoreSupportPage({ params }: { params: { id: string } }) {
  return <StoreSupport businessId={params.id} />;
}
