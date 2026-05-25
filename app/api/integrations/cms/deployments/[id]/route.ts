import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCmsDeploymentRun } from "@/lib/integrations";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: { id: string };
  },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const run = await getCmsDeploymentRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Deployment not found." }, { status: 404 });
  }

  return NextResponse.json({ deployment: run });
}
