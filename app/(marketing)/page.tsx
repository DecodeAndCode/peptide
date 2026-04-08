import { DashboardPreview } from "./components/DashboardPreview";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { PricingPlans } from "./components/PricingPlans";
import { TechnologySection } from "./components/TechnologySection";

export default function MarketingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <DashboardPreview />
      <TechnologySection />
      <PricingPlans />
      <Footer />
    </main>
  );
}
