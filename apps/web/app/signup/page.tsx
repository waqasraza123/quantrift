import { redirect } from "next/navigation";
import { authModeHref } from "@/lib/auth/redirects";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(authModeHref("register", next));
}
