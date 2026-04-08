export function formatRoundedValue(value: number, suffix = "") {
  return `${Math.round(value)}${suffix}`;
}

export function formatSignedRoundedValue(value: number, suffix = "") {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded}${suffix}`;
}

export function quotePromptFragment(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "'this prompt'";
  }

  if (trimmed.includes("'")) {
    return `"${trimmed}"`;
  }

  return `'${trimmed}'`;
}
