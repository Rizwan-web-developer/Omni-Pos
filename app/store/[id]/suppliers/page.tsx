import { SuppliersView } from "@/components/store/SuppliersView";

export default function StoreSuppliersPage({ params }: { params: { id: string } }) {
  return <SuppliersView businessId={params.id} />;
}
