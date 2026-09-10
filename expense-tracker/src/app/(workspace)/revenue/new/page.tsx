import { requireSuperAdmin } from "@/lib/auth/session";
import { RevenueSourceService } from "@/features/revenue/service";
import { getOrCreateDefaultSettings } from "@/lib/server/repositories/settings";
import { RevenueFormClient } from "./client";

export const metadata = {
  title: "Record Revenue | Davo Solutions",
};

export default async function RecordRevenuePage() {
  await requireSuperAdmin();
  
  const sourceService = new RevenueSourceService();
  const [sources, settings] = await Promise.all([
    sourceService.listSources(),
    getOrCreateDefaultSettings(),
  ]);

  const activeSources = sources.filter(s => s.status === "active");

  return <RevenueFormClient sources={activeSources} settings={settings} />;
}
