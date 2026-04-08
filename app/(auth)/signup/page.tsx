import { redirect } from "next/navigation";
import { AuthCard } from "@/app/(auth)/components/AuthCard";
import { SignupForm } from "@/app/(auth)/components/SignupForm";
import { getDashboardContext } from "@/lib/brands";
import type { SubscriptionTier } from "@/types";

interface SignupPageProps {
  searchParams?: {
    error?: string;
    message?: string;
    plan?: SubscriptionTier;
  };
}

function getSelectedPlan(plan: SubscriptionTier | undefined): SubscriptionTier {
  if (plan === "starter" || plan === "growth" || plan === "pro") {
    return plan;
  }

  return "growth";
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
      description="Your account opens the secure dashboard, stores onboarding inputs behind RLS, and sets the plan your first trial should start on."
      alternateHref="/login"
      alternateLabel="Already have access?"
      alternateText="Sign in with your password or request a magic link if you are returning."
      notice={searchParams?.message ?? null}
      error={searchParams?.error ?? null}
    >
      <SignupForm selectedPlan={getSelectedPlan(searchParams?.plan)} />
    </AuthCard>
  );
}
