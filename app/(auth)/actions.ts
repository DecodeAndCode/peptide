"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/supabase/env";
import type { SubscriptionTier } from "@/types";

const emailSchema = z.object({
  email: z.email(),
});

const loginSchema = emailSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signupSchema = loginSchema.extend({
  plan: z.enum(["starter", "growth", "pro"]).optional(),
});

function buildRedirect(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function loginWithPasswordAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(buildRedirect("/login", { error: parsed.error.issues[0]?.message }));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(buildRedirect("/login", { error: "Unable to sign in with that email and password." }));
  }

  redirect("/onboarding");
}

export async function sendMagicLinkAction(formData: FormData) {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(buildRedirect("/login", { error: parsed.error.issues[0]?.message }));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirect(buildRedirect("/login", { error: "We couldn't send the magic link right now." }));
  }

  redirect(
    buildRedirect("/login", {
      message: "Magic link sent. Check your inbox to continue.",
    }),
  );
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    plan: formData.get("plan"),
  });

  if (!parsed.success) {
    redirect(buildRedirect("/signup", { error: parsed.error.issues[0]?.message }));
  }

  const plan = parsed.data.plan as SubscriptionTier | undefined;
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirect(buildRedirect("/signup", { error: "We couldn't create your account right now." }));
  }

  if (!data.session) {
    redirect(
      buildRedirect("/login", {
        message: "Account created. Check your email to finish signing in.",
      }),
    );
  }

  redirect(buildRedirect("/onboarding", { plan }));
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
