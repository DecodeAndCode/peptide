import "server-only";
import { Resend } from "resend";
import { getCycleReportData } from "@/lib/dashboard";
import { buildCycleReportPdf } from "@/lib/reports/pdf-builder";
import { getAppUrl, getResendApiKey } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ReportRecord } from "@/types";

interface GenerateCycleReportOptions {
  cycleId: string;
  recipientEmail?: string | null;
  sendEmail?: boolean;
}

interface GenerateCycleReportResult {
  report: ReportRecord;
  signedUrl: string | null;
  emailed: boolean;
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(getResendApiKey()) : null;
}

export async function generateAndStoreCycleReport({
  cycleId,
  recipientEmail,
  sendEmail = false,
}: GenerateCycleReportOptions): Promise<GenerateCycleReportResult> {
  const data = await getCycleReportData(cycleId);

  if (!data) {
    throw new Error("Unable to load the cycle report data.");
  }

  const supabase = createClient();
  const pdfBuffer = await buildCycleReportPdf(data);
  const storagePath = `${data.brand.id}/${data.cycle.id}/report.pdf`;

  const { error: uploadError } = await supabase.storage.from("reports").upload(storagePath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    throw new Error("Unable to upload the PDF report.");
  }

  const { data: existingReport } = await supabase
    .from("reports")
    .select("*")
    .eq("cycle_id", data.cycle.id)
    .maybeSingle<ReportRecord>();

  let persistedReport: ReportRecord | null = null;

  if (existingReport) {
    const { data: updatedReport, error: updateError } = await supabase
      .from("reports")
      .update({
        storage_path: storagePath,
        is_ready: true,
      })
      .eq("id", existingReport.id)
      .select("*")
      .single<ReportRecord>();

    if (updateError || !updatedReport) {
      throw new Error("Unable to update the stored report record.");
    }

    persistedReport = updatedReport;
  } else {
    const { data: insertedReport, error: insertError } = await supabase
      .from("reports")
      .insert({
        brand_id: data.brand.id,
        cycle_id: data.cycle.id,
        storage_path: storagePath,
        is_ready: true,
      })
      .select("*")
      .single<ReportRecord>();

    if (insertError || !insertedReport) {
      throw new Error("Unable to create the report record.");
    }

    persistedReport = insertedReport;
  }

  const {
    data: signedUrlData,
    error: signedUrlError,
  } = await supabase.storage.from("reports").createSignedUrl(storagePath, 60 * 60);

  if (signedUrlError) {
    throw new Error("Unable to create a signed download URL for the report.");
  }

  let emailed = false;
  const resend = getResendClient();

  if (sendEmail && resend && recipientEmail) {
    const visibilityScore = data.executiveSummary.visibilityScore.toFixed(1);
    const delta = data.executiveSummary.visibilityDelta;
    const deltaText =
      delta === null ? "Baseline cycle" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} points vs. last cycle`;

    await resend.emails.send({
      from: "SuppGo Reports <onboarding@resend.dev>",
      to: recipientEmail,
      subject: `Your SuppGo Visibility Report is ready - ${data.brand.brand_name}, Cycle #${data.cycle.cycle_number}`,
      html: [
        `<h2>Your SuppGo visibility report is ready.</h2>`,
        `<p><strong>${data.brand.brand_name}</strong> finished Cycle #${data.cycle.cycle_number} with a visibility score of <strong>${visibilityScore}</strong>.</p>`,
        `<p>${deltaText}</p>`,
        `<p>Top win: ${data.executiveSummary.topWin}</p>`,
        `<p>Top miss: ${data.executiveSummary.topMiss}</p>`,
        `<p><a href="${getAppUrl()}/dashboard/reports/${data.cycle.id}">Open the in-app report</a></p>`,
        signedUrlData.signedUrl
          ? `<p><a href="${signedUrlData.signedUrl}">Download the PDF report (expires in 1 hour)</a></p>`
          : "",
      ].join(""),
    });

    const { data: emailedReport, error: emailedUpdateError } = await supabase
      .from("reports")
      .update({
        emailed_at: new Date().toISOString(),
      })
      .eq("id", persistedReport.id)
      .select("*")
      .single<ReportRecord>();

    if (emailedUpdateError || !emailedReport) {
      throw new Error("Unable to mark the report as emailed.");
    }

    persistedReport = emailedReport;
    emailed = true;
  }

  return {
    report: persistedReport,
    signedUrl: signedUrlData.signedUrl,
    emailed,
  };
}

export async function getSignedReportDownloadUrl(cycleId: string) {
  const data = await getCycleReportData(cycleId);

  if (!data) {
    return null;
  }

  const supabase = createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("cycle_id", cycleId)
    .maybeSingle<ReportRecord>();

  if (!report?.storage_path || !report.is_ready) {
    const generated = await generateAndStoreCycleReport({ cycleId, sendEmail: false });
    return generated.signedUrl;
  }

  const { data: signedUrlData, error } = await supabase
    .storage
    .from("reports")
    .createSignedUrl(report.storage_path, 60 * 60);

  if (error) {
    throw new Error("Unable to create a signed URL for the existing report.");
  }

  return signedUrlData.signedUrl;
}
