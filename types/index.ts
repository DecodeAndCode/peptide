export type SubscriptionTier = "starter" | "growth" | "pro";
export type SubscriptionStatus = "trial" | "active" | "cancelled";

export interface MarketingMetric {
  label: string;
  value: string;
  delay?: string;
}

export interface MarketingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
}
