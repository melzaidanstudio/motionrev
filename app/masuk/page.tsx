import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { LOGIN_ENABLED } from "@/lib/auth";

export const metadata = { title: "Masuk · motionrev" };

export default function LoginPage() {
  if (!LOGIN_ENABLED) redirect("/beranda");
  return <AuthForm mode="login" />;
}
