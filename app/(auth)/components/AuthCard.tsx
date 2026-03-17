import Link from "next/link";
import { Card } from "@/components/ui/Card";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
  alternateText: string;
  children: React.ReactNode;
  notice?: string | null;
  error?: string | null;
}

export function AuthCard({
  eyebrow,
  title,
  description,
  alternateHref,
  alternateLabel,
  alternateText,
  children,
  notice,
  error,
}: AuthCardProps) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 py-8 md:grid-cols-[1.1fr_0.9fr] md:py-16">
      <div className="flex flex-col justify-center">
        <div className="mb-4 text-xs font-medium uppercase tracking-[2px] text-sage">
          {eyebrow}
        </div>
        <h1 className="max-w-xl font-display text-[clamp(2.4rem,4vw,3.8rem)] leading-[1.1] text-dark">
          {title}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-mid">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm text-mid">
          <span>Secure tenant-isolated workspace</span>
          <span className="text-sage">•</span>
          <span>Supabase session cookies</span>
          <span className="text-sage">•</span>
          <span>Brand onboarding next</span>
        </div>
      </div>

      <Card className="p-8 md:p-10">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="font-display text-2xl text-dark">{alternateLabel}</div>
            <p className="mt-2 text-sm leading-6 text-mid">{alternateText}</p>
          </div>
          <Link href={alternateHref} className="btn-outline whitespace-nowrap px-4 py-2">
            Go there
          </Link>
        </div>

        {notice ? (
          <div className="mb-5 rounded-card border border-sage/20 bg-sage/8 px-4 py-3 text-sm text-dark">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-dark">
            {error}
          </div>
        ) : null}

        {children}
      </Card>
    </div>
  );
}
