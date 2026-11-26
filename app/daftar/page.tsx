import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { LOGIN_ENABLED } from "@/lib/auth";

export const metadata = { title: "Daftar · motionrev" };

export default function RegisterPage() {
  if (!LOGIN_ENABLED) redirect("/beranda");
  return <AuthForm mode="register" />;
}
