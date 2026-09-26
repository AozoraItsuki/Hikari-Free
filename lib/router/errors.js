export function isRateLimitError(error) {
  return (
    error?.data === 429 ||
    /rate-overlimit|rate.limit/i.test(error?.message || '') ||
    error?.output?.statusCode === 429 ||
    /status code 429/i.test(error?.message || '')
  );
}
