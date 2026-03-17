import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/app/(auth)/components/OnboardingWizard";
import { getDashboardContext } from "@/lib/brands";
import type { SubscriptionTier } from "@/types";

interface OnboardingPageProps {
  searchParams?: {
    plan?: SubscriptionTier;
  };
}

function getSelectedPlan(plan: SubscriptionTier | undefined): SubscriptionTier | undefined {
  if (plan === "starter" || plan === "growth" || plan === "pro") {
    return plan;
  }

  return undefined;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const context = await getDashboardContext();

  if (!context) {
    redirect("/login");
  }

  if (context.brand?.onboarding_complete) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialBrand={context.brand}
      initialAnalysis={context.latestSiteAnalysis}
      selectedPlan={getSelectedPlan(searchParams?.plan)}
    />
  );
}
