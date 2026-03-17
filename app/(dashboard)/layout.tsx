import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import { getDashboardContext } from "@/lib/brands";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getDashboardContext();

  if (!context) {
    redirect("/login");
  }

  if (!context.brand) {
    redirect("/onboarding");
  }

  if (!context.brand.onboarding_complete) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-cream lg:pl-[260px]">
      <DashboardSidebar />
      <div className="min-h-screen">
        <DashboardTopbar brand={context.brand} latestCycle={context.latestCycle} />
        <main className="px-6 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
