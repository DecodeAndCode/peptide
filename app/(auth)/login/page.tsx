import { redirect } from "next/navigation";
import { AuthCard } from "@/app/(auth)/components/AuthCard";
import { LoginForm } from "@/app/(auth)/components/LoginForm";
import { getDashboardContext } from "@/lib/brands";

interface LoginPageProps {
  searchParams?: {
    error?: string;
    message?: string;
    redirectedFrom?: string;
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getDashboardContext();

  if (context) {
    redirect(context.brand?.onboarding_complete ? "/dashboard" : "/onboarding");
  }

  const redirectedNotice = searchParams?.redirectedFrom
    ? `Sign in to continue to ${searchParams.redirectedFrom}.`
    : searchParams?.message;

  return (
    <AuthCard
      eyebrow="Secure access"
      title="Return to your brand visibility workspace."
      description="Sign in with email and password, or use a magic link when you need a lighter path back in."
      alternateHref="/signup"
      alternateLabel="New to SuppGo?"
      alternateText="Create your account, choose a starting tier, and move straight into onboarding."
      notice={redirectedNotice ?? null}
      error={searchParams?.error ?? null}
    >
      <LoginForm />
    </AuthCard>
  );
}
