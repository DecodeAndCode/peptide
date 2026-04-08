const CANONICAL_INGREDIENTS = [
  {
    key: "ashwagandha",
    displayName: "Ashwagandha",
    aliases: ["ashwagandha"],
  },
  {
    key: "berberine",
    displayName: "Berberine",
    aliases: ["berberine"],
  },
  {
    key: "collagen",
    displayName: "Collagen",
    aliases: ["collagen"],
  },
  {
    key: "creatine",
    displayName: "Creatine",
    aliases: ["creatine"],
  },
  {
    key: "ghk-cu",
    displayName: "GHK-Cu",
    aliases: ["ghk-cu", "ghk cu", "ghkcu", "copper peptide", "copper peptides"],
  },
  {
    key: "greens-powder",
    displayName: "Greens powder",
    aliases: ["greens powder", "greens powders", "greens"],
  },
  {
    key: "lions-mane",
    displayName: "Lion's mane",
    aliases: ["lion's mane mushroom", "lions mane mushroom", "lion's mane", "lions mane"],
  },
  {
    key: "magnesium",
    displayName: "Magnesium",
    aliases: ["magnesium"],
  },
  {
    key: "nad-plus",
    displayName: "NAD+",
    aliases: ["nad+", "nad +", "nad plus"],
  },
  {
    key: "nmn",
    displayName: "NMN",
    aliases: ["nmn"],
  },
  {
    key: "pre-workout",
    displayName: "Pre-workout",
    aliases: ["pre-workout", "pre workout"],
  },
  {
    key: "probiotics",
    displayName: "Probiotics",
    aliases: ["probiotics", "probiotic"],
  },
  {
    key: "protein",
    displayName: "Protein",
    aliases: ["protein"],
  },
  {
    key: "rhodiola",
    displayName: "Rhodiola",
    aliases: ["rhodiola rosea", "rhodiola"],
  },
  {
    key: "vitamin-c",
    displayName: "Vitamin C",
    aliases: ["vitamin c"],
  },
] as const;

interface CanonicalIngredient {
  key: string;
  displayName: string;
  aliases: readonly string[];
}

const CANONICAL_LOOKUP = new Map<string, CanonicalIngredient>();

function normalizeIngredientPhrase(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeListLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getCanonicalIngredient(value: string) {
  const normalized = normalizeIngredientPhrase(value);

  if (!normalized) {
    return null;
  }

  for (const ingredient of CANONICAL_INGREDIENTS) {
    for (const alias of ingredient.aliases) {
      if (normalizeIngredientPhrase(alias) === normalized) {
        return ingredient;
      }
    }
  }

  return null;
}

function getReplacementPatterns() {
  return CANONICAL_INGREDIENTS.flatMap((ingredient) =>
    ingredient.aliases.map((alias) => ({
      alias,
      displayName: ingredient.displayName,
      regex: new RegExp(
        `(^|[^a-z0-9])(${escapeRegExp(alias).replace(/\\ /g, "\\s+")})(?=[^a-z0-9]|$)`,
        "gi",
      ),
    })),
  ).sort((left, right) => right.alias.length - left.alias.length);
}

const REPLACEMENT_PATTERNS = getReplacementPatterns();

CANONICAL_INGREDIENTS.forEach((ingredient) => {
  ingredient.aliases.forEach((alias) => {
    CANONICAL_LOOKUP.set(normalizeIngredientPhrase(alias), ingredient);
  });
});

export function canonicalizeIngredientName(value: string) {
  return getCanonicalIngredient(value)?.displayName ?? normalizeListLabel(value);
}

export function canonicalizeIngredientList(items: string[], limit = 12) {
  const deduped = new Map<string, string>();

  items.forEach((item) => {
    const cleaned = normalizeListLabel(item);

    if (!cleaned) {
      return;
    }

    const canonical = getCanonicalIngredient(cleaned);
    const key = canonical?.key ?? cleaned.toLowerCase();

    if (!deduped.has(key)) {
      deduped.set(key, canonical?.displayName ?? cleaned);
    }
  });

  return Array.from(deduped.values()).slice(0, limit);
}

export function findIngredientMentionKeys(value: string) {
  const normalized = normalizeIngredientPhrase(value);

  if (!normalized) {
    return [];
  }

  const haystack = ` ${normalized} `;
  const keys = new Set<string>();

  CANONICAL_LOOKUP.forEach((ingredient, alias) => {
    if (haystack.includes(` ${alias} `)) {
      keys.add(ingredient.key);
    }
  });

  return Array.from(keys);
}

export function canonicalizeIngredientMentions(value: string) {
  let normalized = normalizeListLabel(value);

  for (const pattern of REPLACEMENT_PATTERNS) {
    normalized = normalized.replace(pattern.regex, (match, prefix) => {
      const suffix = match.slice(prefix.length);
      const trailing = suffix.match(/[^a-z0-9\s].*$/i)?.[0] ?? "";
      return `${prefix}${pattern.displayName}${trailing}`;
    });
  }

  return normalized.replace(/\s+/g, " ").trim();
}
