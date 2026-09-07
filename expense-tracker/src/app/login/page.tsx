import { AuthPage } from "@/components/auth-page";
import { getConfigurationStatus } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  const { access } = await searchParams;
  return <AuthPage configured={getConfigurationStatus().configured} accessDenied={access === "denied"} />;
}
