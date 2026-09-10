import { requireSuperAdmin } from "@/lib/auth/session";
import { RevenueClient } from "./client";

export const metadata = {
  title: "Revenue | Davo Solutions",
};

export default async function RevenuePage() {
  await requireSuperAdmin();
  
  // Note: the client component will fetch the list and sources from the API to handle pagination and filtering.
  return <RevenueClient />;
}
