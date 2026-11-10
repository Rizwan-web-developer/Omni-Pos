import { StoreSettings } from "@/components/store/StoreSettings";
export default function StoreSettingsPage({ params }: { params: { id: string } }) {
  return <StoreSettings businessId={params.id} />;
}
