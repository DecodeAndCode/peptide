import { CopyButton } from "@/components/dashboard/CopyButton";
import { InfluencerOutreachControls } from "@/components/dashboard/InfluencerOutreachControls";
import { RefreshInfluencerMatchesButton } from "@/components/dashboard/RefreshInfluencerMatchesButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getInfluencerPageData, getInfluencerProfileUrl } from "@/lib/influencers/matcher";

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

function formatVerificationLabel(status: string | null) {
  if (status === "grounded") {
    return "Verified profile";
  }

  if (status === "low_confidence") {
    return "Review suggested";
  }

  return "Needs refresh";
}

export default async function InfluencersPage() {
  const data = await getInfluencerPageData();

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                Influencers
              </div>
              <Badge variant="sage">Active</Badge>
            </div>
            <h2 className="mt-2 font-display text-3xl text-dark">
              Creator discovery for brand-fit outreach
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-mid">
              SuppGo surfaces creators whose content aligns with your brand, niche, and visibility
              gaps from your latest cycle. Review the match rationale, open each profile to confirm
              fit, then copy the suggested outreach message when you are ready to reach out.
            </p>
          </div>
          <RefreshInfluencerMatchesButton />
        </div>
      </Card>

      {!data.latestCompletedCycle ? (
        <Card className="p-6 md:p-8">
          <h3 className="font-display text-2xl text-dark">Complete a cycle to generate creator matches</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
            Run a visibility cycle first. Creator suggestions are generated from that cycle&apos;s
            prompts and your brand profile.
          </p>
        </Card>
      ) : data.matches.length === 0 ? (
        <Card className="p-6 md:p-8">
          <h3 className="font-display text-2xl text-dark">No matches stored for the latest cycle yet</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
            No creators met our quality bar for Cycle #{data.latestCompletedCycle.cycle_number} yet.
            Use Refresh matches to search again, or complete another cycle to refresh the context
            SuppGo uses for suggestions.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.topMatches.map((match) => (
            <Card key={match.id} className="border border-white/10 bg-dark p-6 text-white md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="sage" className="bg-white/10 text-white border-white/10">
                      {match.platform === "instagram" ? "Instagram" : "TikTok"}
                    </Badge>
                    <Badge variant="gold">{formatFollowerRange(match.follower_range)}</Badge>
                    <Badge variant="sage" className="bg-sage/15 text-sage-light border-sage/20">
                      {formatVerificationLabel(match.verification_status)}
                    </Badge>
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

              {match.source_urls?.length ? (
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/60">
                  {match.source_urls.slice(0, 2).map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-white/20 underline-offset-4 hover:text-white"
                    >
                      View profile source
                    </a>
                  ))}
                </div>
              ) : null}

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

              <InfluencerOutreachControls
                influencerId={match.id}
                initialStatus={match.outreach_status}
                initialNotes={match.outreach_notes}
              />
            </Card>
          ))}
        </div>
      )}

      {data.matches.length > data.topMatches.length ? (
        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Additional matches
          </div>
          <h3 className="mt-2 font-display text-2xl text-dark">
            {data.matches.length - data.topMatches.length} more creators are available
          </h3>
          <p className="mt-3 text-sm leading-7 text-mid">
            Your top three creator suggestions appear above. Additional matches may appear in future
            cycles as your visibility context updates.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
