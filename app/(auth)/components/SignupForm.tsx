import { signupAction } from "@/app/(auth)/actions";
import { SUBSCRIPTION_PLANS } from "@/lib/suppgo";
import type { SubscriptionTier } from "@/types";

interface SignupFormProps {
  selectedPlan?: SubscriptionTier;
}

export function SignupForm({ selectedPlan = "growth" }: SignupFormProps) {
  return (
    <form action={signupAction} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-dark">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-dark">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-dark">Starting plan</label>
        <div className="grid gap-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <label
              key={plan.tier}
              className="flex cursor-pointer items-start gap-3 rounded-card border border-sage/15 bg-sage/5 p-4 transition-colors duration-200 hover:border-sage/35"
            >
              <input
                type="radio"
                name="plan"
                value={plan.tier}
                defaultChecked={plan.tier === selectedPlan}
                className="mt-1 h-4 w-4 border-sage text-sage focus:ring-sage"
              />
              <span className="block">
                <span className="block font-medium text-dark">
                  {plan.name} {plan.price}
                </span>
                <span className="mt-1 block text-sm leading-6 text-mid">
                  {plan.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary w-full">
        Create account
      </button>
    </form>
  );
}
