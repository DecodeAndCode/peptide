import { redirect } from "next/navigation";
import { SettingsPageClient } from "@/app/(dashboard)/settings/SettingsPageClient";
import { getDashboardContext } from "@/lib/brands";

export default async function SettingsPage() {
  const context = await getDashboardContext();

  if (!context) {
    redirect("/login");
  }

  if (!context.brand) {
    redirect("/onboarding");
  }

  return <SettingsPageClient brand={context.brand} />;
}
