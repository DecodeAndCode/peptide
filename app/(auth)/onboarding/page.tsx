import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/app/(auth)/components/OnboardingWizard";
import { getDashboardContext } from "@/lib/brands";

export default async function OnboardingPage() {
  const context = await getDashboardContext();

  if (!context) {
    redirect("/login");
  }

  if (context.brand?.onboarding_complete) {
    redirect("/dashboard");
  }

  return <OnboardingWizard initialBrand={context.brand} initialAnalysis={context.latestSiteAnalysis} />;
}
