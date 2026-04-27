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
  const filename =
    content.content_type === "llms_txt"
      ? "llms.txt"
      : buildMarkdownFilename({
          contentType: content.content_type,
          cycleNum,
          titleSlug,
          contentId: content.id,
        });

  const frontmatterLines: string[] = content.content_type === "llms_txt" ? [] : [
    "---",
    `title: "${escapeYamlString(content.title ?? "")}"`,
    `content_type: "${content.content_type}"`,
    `brand: "${escapeYamlString(brand.brand_name)}"`,
    `generated_by: "suppgo"`,
    `cycle: ${cycleNum}`,
    `date: "${date}"`,
  ];

  if (content.content_type !== "llms_txt" && content.target_prompts.length > 0) {
    frontmatterLines.push("target_prompts:");
    for (const prompt of content.target_prompts) {
      frontmatterLines.push(`  - "${escapeYamlString(prompt)}"`);
    }
  }

  if (content.content_type !== "llms_txt" && content.medical_sources.length > 0) {
    frontmatterLines.push("sources:");
    for (const source of content.medical_sources) {
      frontmatterLines.push(`  - "${escapeYamlString(source)}"`);
    }
  }

  if (content.content_type !== "llms_txt") {
    frontmatterLines.push("---", "");
  }
  const fullBody =
    content.content_type === "llms_txt"
      ? content.body
      : frontmatterLines.join("\n") + content.body;

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

function getContentTypeSlug(contentType: GeneratedContentRecord["content_type"]) {
  if (contentType === "faq_snippet") return "faq";
  if (contentType === "product_interaction") return "interaction";
  if (contentType === "llms_txt") return "llms";
  return "content";
}

function buildMarkdownFilename({
  contentType,
  cycleNum,
  titleSlug,
  contentId,
}: {
  contentType: GeneratedContentRecord["content_type"];
  cycleNum: number;
  titleSlug: string;
  contentId: string;
}) {
  const contentTypeSlug = getContentTypeSlug(contentType);
  const idSuffix = contentId.replace(/-/g, "").slice(0, 8) || "content";
  return `${contentTypeSlug}-cycle-${cycleNum}-${titleSlug}-${idSuffix}.md`;
}
