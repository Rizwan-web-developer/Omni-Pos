import type { Metadata } from "next";

import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "Command Center",
  description: "Super admin overview of MRR, tenants, sync and system health.",
};

export default function DashboardPage() {
  return <AdminDashboard />;
}
