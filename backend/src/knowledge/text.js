// Role & Company Knowledge Retrieval (Issue #16). Text normalization shared by
// the knowledge base loader and retrieval.

// Lowercase, and turn accented letters into plain ones ("Nestlé" -> "nestle").
function foldText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

// Words for phrase matching (company names, role aliases, job titles).
// Periods and apostrophes are dropped so "J.P." and "JP" match, and
// "Amazon.com" becomes "amazoncom". Other punctuation separates words.
function phraseTokens(value) {
  return foldText(value)
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Removed only when they are the last word, and never when they are the only
// word left: "Amazon.com, Inc." -> "amazoncom", but "Co" stays "co".
const LEGAL_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "gmbh",
  "inc",
  "incorporated",
  "limited",
  "llc",
  "llp",
  "lp",
  "ltd",
  "plc",
]);

// The key used for exact company matching. Returns "" when nothing usable is
// left. There is no fuzzy or prefix matching: "Amazonian Foods" stays
// "amazonian foods" and can never equal "amazon".
function normalizeCompanyName(value) {
  const tokens = phraseTokens(value);

  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ");
}

const STOPWORDS = new Set(
  (
    "a about above after again all also am an and any are as at be because been " +
    "being both but by can could did do does doing during each etc for from had " +
    "has have having he her here him his how i if in into is it its just me more " +
    "most my no nor not of off on once only or other our ours out over own per " +
    "same she should so some such than that the their them then there these they " +
    "this those through to too under until up us very via was we were what when " +
    "where which while who whom why will with within without would you your"
  ).split(" ")
);

// Very small plural folding so "engineers" matches "engineer" and "queries"
// matches "query". Not a real stemmer, on purpose.
function foldPlural(token) {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (
    token.length > 3 &&
    token.endsWith("s") &&
    !/(ss|us|is)$/.test(token)
  ) {
    return token.slice(0, -1);
  }

  return token;
}

// Tokens for BM25 scoring.
function searchTokens(value) {
  return phraseTokens(value)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(foldPlural);
}

// Plain code-point comparison, so sorting doesn't depend on the machine's
// locale.
function compareStrings(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

module.exports = {
  foldText,
  phraseTokens,
  normalizeCompanyName,
  searchTokens,
  compareStrings,
};
