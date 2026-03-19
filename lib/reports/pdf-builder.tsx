import "server-only";
import React from "react";
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CycleReportData } from "@/lib/dashboard";
import { PROMPT_CATEGORY_LABELS } from "@/lib/suppgo";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#f7f4ef",
    color: "#1e2620",
    fontSize: 11,
    lineHeight: 1.5,
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 32,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#dbe4dd",
    paddingBottom: 14,
    marginBottom: 18,
  },
  logo: {
    fontSize: 20,
    marginBottom: 6,
  },
  subtle: {
    color: "#4a5c50",
    fontSize: 10,
  },
  section: {
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbe4dd",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  metricCard: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#dbe4dd",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fbfaf7",
  },
  metricLabel: {
    color: "#4a5c50",
    fontSize: 9,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
  },
  bullet: {
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe4dd",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ed",
  },
  colPrompt: {
    width: "43%",
    paddingRight: 8,
  },
  colCategory: {
    width: "18%",
    paddingRight: 8,
  },
  colModel: {
    width: "16%",
    paddingRight: 8,
  },
  colStatus: {
    width: "10%",
    paddingRight: 8,
  },
  colCompetitor: {
    width: "13%",
  },
  appendixTitle: {
    fontSize: 12,
    marginBottom: 6,
  },
  sourceLink: {
    color: "#7a9e87",
    textDecoration: "none",
    marginBottom: 2,
  },
});

function PdfReport({ data }: { data: CycleReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            Supp<Text style={{ color: "#7a9e87" }}>Go</Text>
          </Text>
          <Text>{data.brand.brand_name} Visibility Report</Text>
          <Text style={styles.subtle}>
            Cycle #{data.cycle.cycle_number} | Completed{" "}
            {new Date(data.cycle.completed_at ?? data.cycle.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Executive Summary</Text>
          <Text>{data.executiveSummary.summaryText}</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Visibility score</Text>
              <Text style={styles.metricValue}>{data.executiveSummary.visibilityScore.toFixed(1)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Delta</Text>
              <Text style={styles.metricValue}>
                {data.executiveSummary.visibilityDelta === null
                  ? "Baseline"
                  : `${data.executiveSummary.visibilityDelta >= 0 ? "+" : ""}${data.executiveSummary.visibilityDelta.toFixed(1)}`}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Mention rate</Text>
              <Text style={styles.metricValue}>{data.executiveSummary.mentionRate.toFixed(1)}%</Text>
            </View>
          </View>
          <Text style={styles.bullet}>Top win: {data.executiveSummary.topWin}</Text>
          <Text style={styles.bullet}>Top miss: {data.executiveSummary.topMiss}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Hits &amp; Misses Analysis</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colPrompt}>Prompt</Text>
            <Text style={styles.colCategory}>Category</Text>
            <Text style={styles.colModel}>Model</Text>
            <Text style={styles.colStatus}>Hit?</Text>
            <Text style={styles.colCompetitor}>Competitors</Text>
          </View>
          {data.prompts.slice(0, 10).map((row) => (
            <View key={row.id} style={styles.tableRow}>
              <Text style={styles.colPrompt}>{row.promptText}</Text>
              <Text style={styles.colCategory}>{PROMPT_CATEGORY_LABELS[row.category]}</Text>
              <Text style={styles.colModel}>{row.model}</Text>
              <Text style={styles.colStatus}>{row.mentioned ? "Yes" : "No"}</Text>
              <Text style={styles.colCompetitor}>{row.competitorsMentioned.join(", ") || "-"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Prompt Category Performance</Text>
          {data.categoryPerformance.map((row) => (
            <Text key={row.category} style={styles.bullet}>
              {row.label}: GPT-4o {row["gpt-4o"].toFixed(1)}% | Claude {row["claude-sonnet"].toFixed(1)}% |
              Perplexity {row["perplexity-sonar-pro"].toFixed(1)}%
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Competitor Gap Analysis</Text>
          {data.competitorGaps.slice(0, 6).map((gap) => (
            <View key={gap.promptText} style={{ marginBottom: 8 }}>
              <Text style={styles.bullet}>{gap.promptText}</Text>
              <Text style={styles.subtle}>Competitors: {gap.competitors.join(", ")}</Text>
              <Text style={styles.subtle}>Likely reason: {gap.likelyReason}</Text>
              <Text style={styles.subtle}>Suggested fix: {gap.suggestedFix}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Generated Content Recommendations</Text>
          {data.generatedContent.slice(0, 4).map((item) => (
            <View key={item.id} style={{ marginBottom: 10 }}>
              <Text style={styles.appendixTitle}>{item.title ?? item.content_type}</Text>
              <Text>{item.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Influencer Match Preview</Text>
          {data.influencerPreview.map((item) => (
            <Text key={item.title} style={styles.bullet}>
              {item.title}: {item.description}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appendix: Source Links</Text>
          {data.generatedContent
            .flatMap((item) => item.medical_sources)
            .slice(0, 12)
            .map((source) => (
              <Link key={source} src={source} style={styles.sourceLink}>
                {source}
              </Link>
            ))}
        </View>
      </Page>
    </Document>
  );
}

export async function buildCycleReportPdf(data: CycleReportData) {
  return renderToBuffer(<PdfReport data={data} />);
}
