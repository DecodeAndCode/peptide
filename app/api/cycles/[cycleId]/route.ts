import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CycleRecord, PromptRecord } from "@/types";

export const runtime = "nodejs";

const cycleParamsSchema = z.object({
  cycleId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: { cycleId: string } },
) {
  const parsedParams = cycleParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid cycle id." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [{ data: cycle }, { data: prompts }] = await Promise.all([
    supabase
      .from("cycles")
      .select("*")
      .eq("id", parsedParams.data.cycleId)
      .maybeSingle<CycleRecord>(),
    supabase
      .from("prompts")
      .select("*")
      .eq("cycle_id", parsedParams.data.cycleId)
      .order("created_at", { ascending: true })
      .returns<PromptRecord[]>(),
  ]);

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
  }

  return NextResponse.json({
    cycle,
    prompts: prompts ?? [],
  });
}
