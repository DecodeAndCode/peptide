import "server-only";
import { createGitHubClient } from "@/lib/github/client";
import type { GeneratedContentType } from "@/types";

export type DeploymentStrategy = "markdown_file" | "html_inplace" | "unknown";

interface AnalyzeRepoOptions {
  accessToken: string;
  repoFullName: string;
  configuredContentDir: string;
  contentType: GeneratedContentType;
}

interface ScoreBreakdown {
  markdown: number;
  html: number;
}

export interface RepoDeploymentPreflight {
  strategy: DeploymentStrategy;
  confidence: number;
  reasons: string[];
  recommendedContentDir: string | null;
  targetFileCandidates: string[];
  recommendedTargetPath: string | null;
  framework: string | null;
  scoreBreakdown: ScoreBreakdown;
}

const KNOWN_CONTENT_DIRS = [
  "content",
  "content/blog",
  "content/posts",
  "src/content",
  "src/content/blog",
  "src/content/posts",
  "blog",
  "docs",
  "posts",
  "_posts",
];

function normalizeConfiguredDir(value: string) {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseRepo(repoFullName: string) {
  const slashIndex = repoFullName.indexOf("/");

  if (slashIndex === -1) {
    throw new Error(`Invalid repo format: "${repoFullName}". Expected "owner/repo".`);
  }

  return {
    owner: repoFullName.slice(0, slashIndex),
    repo: repoFullName.slice(slashIndex + 1),
  };
}

async function getDefaultBranchTreePaths({
  accessToken,
  owner,
  repo,
}: {
  accessToken: string;
  owner: string;
  repo: string;
}) {
  const octokit = createGitHubClient(accessToken);
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  const commitSha = refData.object.sha;
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });
  const treeSha = commitData.tree.sha;

  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "1",
  });

  const paths = (treeData.tree ?? [])
    .map((entry) => entry.path)
    .filter((path): path is string => Boolean(path));

  return { defaultBranch, paths };
}

function detectFramework(paths: string[]) {
  const has = (needle: string) => paths.some((path) => path === needle);

  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) {
    return "nextjs";
  }

  if (has("astro.config.mjs") || has("astro.config.ts")) {
    return "astro";
  }

  if (has("gatsby-config.js") || has("gatsby-config.ts")) {
    return "gatsby";
  }

  if (has("docusaurus.config.js") || has("docusaurus.config.ts")) {
    return "docusaurus";
  }

  if (has("hugo.toml") || has("config.toml")) {
    return "hugo";
  }

  return null;
}

function listMarkdownDirs(paths: string[]) {
  const markdownPaths = paths.filter((path) => /\.(md|mdx)$/i.test(path));
  const dirCounts = new Map<string, number>();

  markdownPaths.forEach((path) => {
    const segments = path.split("/");
    const dir = segments.length > 1 ? segments.slice(0, -1).join("/") : ".";
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
  });

  return [...dirCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([dir]) => dir);
}

function getCandidateHtmlTargets(paths: string[]) {
  return paths.filter((path) => {
    if (!/\.(html|htm)$/i.test(path)) return false;
    return /(faq|learn|help|support|knowledge|guide)/i.test(path);
  });
}

function getAllHtmlTargets(paths: string[]) {
  return paths.filter((path) => /\.(html|htm)$/i.test(path));
}

function detectLlmsTxtPath(paths: string[]) {
  if (paths.includes("llms.txt")) return "llms.txt";
  if (paths.includes("public/llms.txt")) return "public/llms.txt";
  return null;
}

function computePreflight({
  configuredDir,
  paths,
  contentType,
}: {
  configuredDir: string;
  paths: string[];
  contentType: GeneratedContentType;
}): RepoDeploymentPreflight {
  const reasons: string[] = [];
  const framework = detectFramework(paths);
  const markdownDirs = listMarkdownDirs(paths);
  const candidateHtmlTargets = getCandidateHtmlTargets(paths);
  const allHtmlTargets = getAllHtmlTargets(paths);
  const llmsTxtPath = detectLlmsTxtPath(paths);
  const configuredDirNormalized = normalizeConfiguredDir(configuredDir);

  let markdownScore = 0;
  let htmlScore = 0;

  if (framework) {
    reasons.push(`Detected framework: ${framework}.`);
    markdownScore += 10;
    htmlScore += 5;
  }

  if (paths.some((path) => path === "package.json")) {
    markdownScore += 8;
    reasons.push("Found package.json.");
  }

  if (configuredDirNormalized) {
    const configuredMatches = paths.some(
      (path) => path === configuredDirNormalized || path.startsWith(`${configuredDirNormalized}/`),
    );

    if (configuredMatches) {
      markdownScore += 30;
      reasons.push(`Configured content directory exists: ${configuredDirNormalized}.`);
    } else {
      reasons.push(`Configured content directory was not found: ${configuredDirNormalized}.`);
    }
  } else {
    reasons.push("No content directory configured.");
  }

  const knownDirMatch = KNOWN_CONTENT_DIRS.find((dir) =>
    paths.some((path) => path === dir || path.startsWith(`${dir}/`)),
  );
  if (knownDirMatch) {
    markdownScore += 25;
    reasons.push(`Detected known content directory: ${knownDirMatch}.`);
  }

  const markdownFileCount = paths.filter((path) => /\.(md|mdx)$/i.test(path)).length;
  if (markdownFileCount >= 5) {
    markdownScore += 20;
    reasons.push(`Found ${markdownFileCount} markdown/MDX files.`);
  } else if (markdownFileCount > 0) {
    markdownScore += 10;
    reasons.push(`Found ${markdownFileCount} markdown/MDX files.`);
  }

  if (candidateHtmlTargets.length > 0) {
    htmlScore += 35;
    reasons.push(`Found ${candidateHtmlTargets.length} likely HTML FAQ/learn targets.`);
  }

  const htmlFaqHints = paths.filter((path) => /(faq|learn|support|help)/i.test(path)).length;
  if (htmlFaqHints >= 3) {
    htmlScore += 15;
    reasons.push("Found multiple FAQ/learn/support path hints.");
  }

  if (llmsTxtPath) {
    reasons.push(`Detected llms.txt target path: ${llmsTxtPath}.`);
  }

  const topMarkdownDir = markdownDirs[0] ?? null;
  const recommendedContentDir = configuredDirNormalized || knownDirMatch || topMarkdownDir || null;
  let strategy: DeploymentStrategy = "unknown";
  let recommendedTargetPath: string | null = null;

  if (contentType === "llms_txt") {
    strategy = "markdown_file";
    recommendedTargetPath = llmsTxtPath ?? "llms.txt";
    markdownScore = Math.max(markdownScore, 70);
    reasons.push("Content type is llms_txt, targeting llms.txt file directly.");
  } else if (contentType === "faq_snippet" || contentType === "product_interaction") {
    const configuredHtmlTarget =
      configuredDirNormalized && /\.(html|htm)$/i.test(configuredDirNormalized)
        ? allHtmlTargets.find((path) => path === configuredDirNormalized) ?? null
        : null;

    const bestHtmlTarget =
      configuredHtmlTarget ??
      candidateHtmlTargets[0] ??
      (allHtmlTargets.length > 0 && allHtmlTargets.length <= 5 ? allHtmlTargets[0] : null);

    if (bestHtmlTarget) {
      strategy = "html_inplace";
      recommendedTargetPath = bestHtmlTarget;
      htmlScore = Math.max(htmlScore + 10, 72);
      reasons.push(
        `Content type ${contentType} prefers in-place HTML updates when FAQ-like pages are detected. Selected target: ${recommendedTargetPath}.`,
      );
      if (configuredHtmlTarget) {
        reasons.push(`Using configured HTML target from settings: ${configuredHtmlTarget}.`);
      } else if (candidateHtmlTargets.length === 0 && allHtmlTargets.length > 0) {
        reasons.push(
          `No explicit FAQ/learn HTML filename found; selected fallback HTML target from repository (${recommendedTargetPath}).`,
        );
      }
    } else if (markdownScore > 0) {
      strategy = "markdown_file";
      reasons.push(
        `No HTML FAQ/learn targets were detected for ${contentType}, so markdown strategy was selected.`,
      );
    }
  } else if (markdownScore >= htmlScore && markdownScore > 0) {
    strategy = "markdown_file";
  } else if (htmlScore > markdownScore) {
    strategy = "html_inplace";
    recommendedTargetPath = candidateHtmlTargets[0] ?? null;
  }

  const confidence = Math.max(markdownScore, htmlScore);

  return {
    strategy,
    confidence: Math.min(100, confidence),
    reasons,
    recommendedContentDir,
    targetFileCandidates: strategy === "html_inplace" ? candidateHtmlTargets.slice(0, 10) : [],
    recommendedTargetPath,
    framework,
    scoreBreakdown: {
      markdown: Math.min(100, markdownScore),
      html: Math.min(100, htmlScore),
    },
  };
}

export async function analyzeRepoForDeployment(options: AnalyzeRepoOptions): Promise<RepoDeploymentPreflight> {
  const { accessToken, repoFullName, configuredContentDir, contentType } = options;
  const { owner, repo } = parseRepo(repoFullName);
  const { paths } = await getDefaultBranchTreePaths({
    accessToken,
    owner,
    repo,
  });

  return computePreflight({
    configuredDir: configuredContentDir,
    paths,
    contentType,
  });
}
