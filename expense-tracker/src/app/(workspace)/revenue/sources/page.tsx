import { requireSuperAdmin } from "@/lib/auth/session";
import { RevenueSourceService } from "@/features/revenue/service";
import { RevenueSourcesClient } from "./client";

export const metadata = {
  title: "Revenue Sources | Davo Solutions",
};

export default async function RevenueSourcesPage() {
  await requireSuperAdmin();
  
  const service = new RevenueSourceService();
  // Fetch active and archived sources for the management page
  const sources = await service.listSources();

  return <RevenueSourcesClient initialSources={sources} />;
}
