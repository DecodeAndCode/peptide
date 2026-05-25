import { redirect } from "next/navigation";
import { AuthCard } from "@/app/(auth)/components/AuthCard";
import { SignupForm } from "@/app/(auth)/components/SignupForm";
import { getDashboardContext } from "@/lib/brands";

interface SignupPageProps {
  searchParams?: {
    error?: string;
    message?: string;
  };
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const context = await getDashboardContext();

  if (context) {
    redirect(context.brand?.onboarding_complete ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthCard
      eyebrow="Start your trial"
      title="Create the workspace your brand team will build from."
      description="Your account opens a secure workspace and a free trial: how AI talks about your wellness or supplement brand, where you lose out to competitors, and actionable drafts and ideas—not a laundry list of technical features."
      alternateHref="/login"
      alternateLabel="Already have access?"
      alternateText="Sign in with your password or request a magic link if you are returning."
      notice={searchParams?.message ?? null}
      error={searchParams?.error ?? null}
    >
      <SignupForm />
    </AuthCard>
  );
}
