import { UpgradeView } from "@/components/store/UpgradeView";

export default function StoreUpgradePage({ params }: { params: { id: string } }) {
  return <UpgradeView businessId={params.id} />;
}
