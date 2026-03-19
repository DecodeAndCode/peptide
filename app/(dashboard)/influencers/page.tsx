import { CopyButton } from "@/components/dashboard/CopyButton";
import { RefreshInfluencerMatchesButton } from "@/components/dashboard/RefreshInfluencerMatchesButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getInfluencerPageData, getInfluencerProfileUrl } from "@/lib/influencers/matcher";
import { getTierAnalysisConfig } from "@/lib/suppgo";

function formatFollowerRange(value: string | null) {
  if (value === "micro_10k_50k") {
    return "Micro 10k-50k";
  }

  if (value === "mid_50k_200k") {
    return "Mid 50k-200k";
  }

  if (value === "macro_200k+") {
    return "Macro 200k+";
  }

  return "Follower tier pending";
}

export default async function InfluencersPage() {
  const data = await getInfluencerPageData();

  if (!data) {
    return null;
  }

  const tierConfig = getTierAnalysisConfig(data.brand.subscription_tier);

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                Influencers
              </div>
              <Badge variant={tierConfig.influencerMatching ? "sage" : "gold"}>
                {tierConfig.influencerMatching ? "Pro enabled" : "Pro feature"}
              </Badge>
            </div>
            <h2 className="mt-2 font-display text-3xl text-dark">
              Public-web creator discovery for brand-fit outreach
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-mid">
              Influencer suggestions are sourced from public web data via Perplexity. Verify
              profiles and follower counts before outreach. SuppGo does not guarantee accuracy of
              third-party account data.
            </p>
          </div>
          {tierConfig.influencerMatching ? <RefreshInfluencerMatchesButton /> : null}
        </div>
      </Card>

      {!tierConfig.influencerMatching ? (
        <Card className="p-6 md:p-8">
          <h3 className="font-display text-2xl text-dark">Upgrade to Pro to unlock influencer matching</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
            Pro adds Perplexity-grounded creator discovery, GPT-4o brand-fit scoring, de-duplicated
            match rotation across cycles, and copy-ready outreach messages with direct profile links.
          </p>
        </Card>
      ) : !data.latestCompletedCycle ? (
        <Card className="p-6 md:p-8">
          <h3 className="font-display text-2xl text-dark">Complete a cycle to generate creator matches</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
            Influencer matching uses your most recent completed cycle to prioritize niches and gap
            prompts before discovering real public profiles.
          </p>
        </Card>
      ) : data.matches.length === 0 ? (
        <Card className="p-6 md:p-8">
          <h3 className="font-display text-2xl text-dark">No matches stored for the latest cycle yet</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
            Refresh matches to run a grounded discovery pass for Cycle #
            {data.latestCompletedCycle.cycle_number}.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.matches.map((match) => (
            <Card key={match.id} className="border border-white/10 bg-dark p-6 text-white md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="sage" className="bg-white/10 text-white border-white/10">
                      {match.platform === "instagram" ? "Instagram" : "TikTok"}
                    </Badge>
                    <Badge variant="gold">{formatFollowerRange(match.follower_range)}</Badge>
                  </div>
                  <h3 className="mt-4 font-display text-2xl text-white">
                    {match.display_name ?? `@${match.handle}`}
                  </h3>
                  <p className="mt-2 text-sm text-white/70">@{match.handle}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <CopyButton value={match.outreach_message ?? ""} label="Copy DM" />
                  <a
                    href={getInfluencerProfileUrl(match)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline border-white/15 bg-white/5 px-5 py-2.5 text-white hover:bg-white/10"
                  >
                    Open Profile
                  </a>
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-white/75">
                {match.match_reason ?? "Brand-fit rationale will appear here once scoring completes."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {match.niche_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill border border-sage/20 bg-sage/10 px-3 py-1 text-xs text-sage-light"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <details className="mt-6 rounded-card border border-white/10 bg-white/5 p-4">
                <summary className="cursor-pointer text-sm font-medium text-white">
                  View outreach message
                </summary>
                <p className="mt-4 text-sm leading-7 text-white/75">
                  {match.outreach_message ?? "Outreach copy will appear here once generated."}
                </p>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
