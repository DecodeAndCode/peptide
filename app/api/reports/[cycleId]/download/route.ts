import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedReportDownloadUrl } from "@/lib/reports/report-service";
import { enforceRateLimit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({
  cycleId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: { cycleId: string } },
) {
  const parsed = paramsSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cycle id." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rateLimitError = await enforceRateLimit({
    request: _request,
    bucket: "report",
    userId: user.id,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const signedUrl = await getSignedReportDownloadUrl(parsed.data.cycleId);

    if (!signedUrl) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't create the report download link right now." },
      { status: 500 },
    );
  }
}
