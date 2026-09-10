import { SettingsService } from "@/features/settings/service";
import { SettingsClient } from "./client";

export const metadata = {
  title: "Settings | Davo Solutions",
};

export default async function SettingsPage() {
  const service = new SettingsService();
  const settings = await service.getSettings();
  const rates = await service.getActiveRates();

  return <SettingsClient initialSettings={settings} initialRates={rates} />;
}
