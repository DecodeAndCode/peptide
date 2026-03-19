import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAndStoreCycleReport } from "@/lib/reports/report-service";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  cycleId: z.string().uuid(),
  sendEmail: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const sameOriginError = enforceSameOrigin(request);

  if (sameOriginError) {
    return sameOriginError;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rateLimitError = await enforceRateLimit({
    request,
    bucket: "report",
    userId: user.id,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report request." }, { status: 400 });
  }

  try {
    const result = await generateAndStoreCycleReport({
      cycleId: parsed.data.cycleId,
      recipientEmail: user.email ?? null,
      sendEmail: parsed.data.sendEmail,
    });

    return NextResponse.json({
      report: result.report,
      signedUrl: result.signedUrl,
      emailed: result.emailed,
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't prepare that report right now. Please retry shortly." },
      { status: 500 },
    );
  }
}
