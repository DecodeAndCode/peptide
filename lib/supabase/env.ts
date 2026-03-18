function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseUrl() {
  return getEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getSupabaseServiceRoleKey() {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getOpenAiApiKey() {
  return getEnv("OPENAI_API_KEY");
}

export function getAnthropicApiKey() {
  return getEnv("ANTHROPIC_API_KEY");
}

export function getPerplexityApiKey() {
  return getEnv("PERPLEXITY_API_KEY");
}

export function isSuppgoTestModeEnabled() {
  const explicitValue = process.env.SUPPGO_TEST_MODE;

  if (explicitValue === "true") {
    return true;
  }

  if (explicitValue === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

export function getSuppgoTestModePromptExecutionCap() {
  return 10;
}
