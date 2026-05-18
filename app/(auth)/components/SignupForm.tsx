import { signupAction } from "@/app/(auth)/actions";
import { DEFAULT_TRIAL_SUBSCRIPTION_TIER, SUBSCRIPTION_PLANS } from "@/lib/suppgo";

export function SignupForm() {
  const offering = SUBSCRIPTION_PLANS[0];

  return (
    <form action={signupAction} className="space-y-5">
      <input type="hidden" name="plan" value={DEFAULT_TRIAL_SUBSCRIPTION_TIER} />

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

      <div className="rounded-card border border-sage/15 bg-sage/5 p-4 text-sm leading-6 text-mid">
        <div className="font-medium text-dark">Your trial includes</div>
        <ul className="mt-3 list-none space-y-1.5 pl-0 text-mid">
          {offering.features.map((line) => (
            <li key={line} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-sage" aria-hidden="true">
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <button type="submit" className="btn-primary w-full">
        Create account
      </button>
    </form>
  );
}
