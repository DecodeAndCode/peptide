import { redirect } from "next/navigation";
import { SettingsPageClient } from "@/app/(dashboard)/settings/SettingsPageClient";
import { getDashboardContext } from "@/lib/brands";
import { getGitHubIntegrationStatus, getWebflowIntegrationStatus } from "@/lib/integrations";

export default async function SettingsPage() {
  const context = await getDashboardContext();

  if (!context) {
    redirect("/login");
  }

  if (!context.brand) {
    redirect("/onboarding");
  }

  const githubIntegration = await getGitHubIntegrationStatus(context.brand.id);
  const webflowIntegration = await getWebflowIntegrationStatus(context.brand.id);

  return (
    <SettingsPageClient
      brand={context.brand}
      githubIntegration={githubIntegration}
      webflowIntegration={webflowIntegration}
    />
  );
}
