// Role & Company Knowledge Retrieval (Issue #16). A small Okapi BM25 scorer.
// The knowledge base has around a hundred sections, so everything stays in
// memory and is scored directly.
const { compareStrings } = require("./text");

const DEFAULTS = { k1: 1.2, b: 0.75 };

// documents: [{ id, tokens }] where tokens is an array of search tokens.
function createBm25Index(documents, options = {}) {
  const { k1, b } = { ...DEFAULTS, ...options };
  const docFrequency = new Map();
  const docs = new Map();
  let totalLength = 0;

  for (const { id, tokens } of documents) {
    if (docs.has(id)) {
      throw new Error(`Duplicate BM25 document id: ${id}`);
    }

    const termFrequency = new Map();

    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }

    for (const token of termFrequency.keys()) {
      docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
    }

    docs.set(id, { length: tokens.length, termFrequency });
    totalLength += tokens.length;
  }

  return {
    k1,
    b,
    size: docs.size,
    averageLength: docs.size > 0 ? totalLength / docs.size : 0,
    docFrequency,
    docs,
  };
}

// Always positive, so a rare match never lowers a score.
function inverseDocumentFrequency(index, token) {
  const frequency = index.docFrequency.get(token) || 0;

  return Math.log(1 + (index.size - frequency + 0.5) / (frequency + 0.5));
}

// Scores the given ids (every document when ids is omitted). Repeated query
// terms count once, so a long job description doesn't outweigh a short title.
// Returns [{ id, score, matchedTerms }], best first; ties go to the smaller id.
function scoreBm25(index, queryTokens, ids) {
  const terms = [...new Set(queryTokens)];
  const candidates = ids ? [...ids] : [...index.docs.keys()];

  const results = candidates.map((id) => {
    const doc = index.docs.get(id);

    if (!doc) {
      throw new Error(`Unknown BM25 document id: ${id}`);
    }

    let score = 0;
    const matchedTerms = [];

    for (const term of terms) {
      const frequency = doc.termFrequency.get(term);

      if (!frequency) continue;

      const lengthRatio =
        index.averageLength > 0 ? doc.length / index.averageLength : 1;
      const saturation =
        (frequency * (index.k1 + 1)) /
        (frequency + index.k1 * (1 - index.b + index.b * lengthRatio));

      score += inverseDocumentFrequency(index, term) * saturation;
      matchedTerms.push(term);
    }

    return { id, score, matchedTerms: matchedTerms.sort(compareStrings) };
  });

  return results.sort(
    (left, right) => right.score - left.score || compareStrings(left.id, right.id)
  );
}

module.exports = {
  createBm25Index,
  scoreBm25,
};
