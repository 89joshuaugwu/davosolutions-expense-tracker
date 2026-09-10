import { requireSuperAdmin } from "@/lib/auth/session";
import { RevenueSourceService } from "@/features/revenue/service";
import { getRevenueById } from "@/lib/server/repositories/revenue";
import { notFound } from "next/navigation";
import { RevenueDetailClient } from "./client";

export const metadata = {
  title: "Revenue Detail | Davo Solutions",
};

export default async function RevenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;

  const record = await getRevenueById(id);
  if (!record) {
    notFound();
  }

  const sourceService = new RevenueSourceService();
  const sources = await sourceService.listSources();

  return <RevenueDetailClient initialRecord={record} sources={sources} />;
}
