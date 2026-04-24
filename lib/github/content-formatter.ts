import "server-only";
import type { GeneratedContentRecord, BrandRecord, CycleRecord } from "@/types";

interface FormattedContent {
  filename: string;
  body: string;
}

export function formatContentAsMarkdown(
  content: GeneratedContentRecord,
  brand: BrandRecord,
  cycle: CycleRecord | null,
): FormattedContent {
  const date = new Date().toISOString().split("T")[0];
  const cycleNum = cycle?.cycle_number ?? 0;
  const titleSlug = slugify(content.title ?? content.content_type);
  const filename = `${titleSlug}.md`;

  const frontmatterLines: string[] = [
    "---",
    `title: "${escapeYamlString(content.title ?? "")}"`,
    `content_type: "${content.content_type}"`,
    `brand: "${escapeYamlString(brand.brand_name)}"`,
    `generated_by: "suppgo"`,
    `cycle: ${cycleNum}`,
    `date: "${date}"`,
  ];

  if (content.target_prompts.length > 0) {
    frontmatterLines.push("target_prompts:");
    for (const prompt of content.target_prompts) {
      frontmatterLines.push(`  - "${escapeYamlString(prompt)}"`);
    }
  }

  if (content.medical_sources.length > 0) {
    frontmatterLines.push("sources:");
    for (const source of content.medical_sources) {
      frontmatterLines.push(`  - "${escapeYamlString(source)}"`);
    }
  }

  frontmatterLines.push("---", "");

  const fullBody = frontmatterLines.join("\n") + content.body;

  return { filename, body: fullBody };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "content";
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
