import { AuthPage } from "@/components/auth-page";
import { getConfigurationStatus } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export default function ForgotPasswordPage() { return <AuthPage configured={getConfigurationStatus().configured} reset />; }
