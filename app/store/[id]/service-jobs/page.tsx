import { ServiceJobsView } from "@/components/store/ServiceJobsView";

export default function StoreServiceJobsPage({ params }: { params: { id: string } }) {
  return <ServiceJobsView businessId={params.id} />;
}
