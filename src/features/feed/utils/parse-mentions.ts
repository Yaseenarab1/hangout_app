// Identical regex to the SQL trigger in handle_post_mentions():
// regexp_matches(caption, '@([a-zA-Z0-9_]{3,30})', 'g')
const MENTION_RE = /@([a-zA-Z0-9_]{3,30})/g;

export interface ParsedMention {
  username: string; // lower-cased
  raw: string;      // original match, e.g. "@Alice"
  index: number;    // char position in the string
}

/** Extract all @mentions from a caption string. */
export function parseMentions(caption: string): ParsedMention[] {
  if (!caption) return [];
  const results: ParsedMention[] = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex each call since the regex is module-level with /g flag
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(caption)) !== null) {
    if (!m[1]) continue;
    results.push({
      username: m[1].toLowerCase(),
      raw: m[0],
      index: m.index,
    });
  }
  return results;
}

/** Return unique lowercase usernames mentioned in a caption. */
export function uniqueMentionedUsernames(caption: string): string[] {
  const seen = new Set<string>();
  return parseMentions(caption)
    .map((m) => m.username)
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}
