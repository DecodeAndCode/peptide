import { vi } from "vitest";

if (!process.env.NODE_ENV) {
  (process.env as Record<string, string>).NODE_ENV = "test";
}
process.env.SUPPGO_TEST_MODE = "true";
process.env.INTEGRATION_ENCRYPTION_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY ??
  "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role";

vi.mock("server-only", () => ({}));

const noopBuilder: Record<string, unknown> = {};
const buildPromise = <T,>(data: T = null as T) =>
  Promise.resolve({ data, error: null, count: null, status: 200, statusText: "OK" });

const buildChain = () => {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "gt",
    "lt",
    "gte",
    "lte",
    "like",
    "ilike",
    "in",
    "is",
    "order",
    "limit",
    "range",
    "match",
    "filter",
    "not",
    "or",
    "single",
    "maybeSingle",
  ]) {
    chain[method] = passthrough;
  }
  chain.then = (onFulfilled: (value: { data: null; error: null }) => unknown) =>
    buildPromise(null).then(onFulfilled);
  return chain;
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => buildChain(),
    auth: {
      getUser: () => buildPromise({ user: null }),
      getSession: () => buildPromise({ session: null }),
    },
    storage: { from: () => ({ download: () => buildPromise(null) }) },
  }),
  createServiceRoleClient: () => ({
    from: () => buildChain(),
    auth: { admin: { deleteUser: () => buildPromise(null) } },
  }),
}));

void noopBuilder;
