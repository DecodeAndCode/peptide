import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // Cookie writes belong in middleware and route handlers.
      },
      remove() {
        // Cookie writes belong in middleware and route handlers.
      },
    },
  });
}
