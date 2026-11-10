import { ShopShell } from "@/components/store/ShopShell";

export default function StoreLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  return <ShopShell businessId={params.id}>{children}</ShopShell>;
}
