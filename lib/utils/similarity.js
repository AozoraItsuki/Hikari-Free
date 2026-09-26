const getBigrams = (string) => {
  if (string.length < 2) return new Set([string]);
  const bigrams = new Set();
  for (let i = 0; i < string.length - 1; i++) {
    bigrams.add(`${string[i]}${string[i + 1]}`);
  }
  return bigrams;
};

export function similarity(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const leftBigrams = getBigrams(String(left));
  const rightBigrams = getBigrams(String(right));
  let intersectionCount = 0;
  for (const bigram of leftBigrams.values()) {
    if (rightBigrams.has(bigram)) intersectionCount++;
  }
  const unionSize = leftBigrams.size + rightBigrams.size - intersectionCount;
  return (2 * intersectionCount) / unionSize;
}

export function didYouMean(input, options, threshold = 0.4) {
  const normalized = String(input || '')
    .toLowerCase()
    .trim();
  if (!normalized) return null;
  let best = null;
  let bestScore = 0;
  for (const option of options) {
    const opt = String(option || '');
    if (!opt) continue;
    let score = similarity(normalized, opt.toLowerCase());
    if (opt.startsWith(normalized) || normalized.startsWith(opt)) score += 0.24;
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  return bestScore >= threshold ? best : null;
}
