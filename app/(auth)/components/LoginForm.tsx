import Link from "next/link";
import { loginWithPasswordAction, sendMagicLinkAction } from "@/app/(auth)/actions";

interface LoginFormProps {
  email?: string;
}

export function LoginForm({ email = "" }: LoginFormProps) {
  return (
    <div className="space-y-8">
      <form action={loginWithPasswordAction} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-dark">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            required
            className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-dark">
              Password
            </label>
            <Link href="/signup" className="text-sm text-sage hover:text-dark">
              Need an account?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-sage/15" />
        <span className="text-xs font-medium uppercase tracking-[1.5px] text-mid">
          or
        </span>
        <div className="h-px flex-1 bg-sage/15" />
      </div>

      <form action={sendMagicLinkAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="magic-link-email" className="text-sm font-medium text-dark">
            Magic link email
          </label>
          <input
            id="magic-link-email"
            name="email"
            type="email"
            defaultValue={email}
            required
            className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
          />
        </div>

        <button type="submit" className="btn-outline w-full">
          Email me a magic link
        </button>
      </form>
    </div>
  );
}
