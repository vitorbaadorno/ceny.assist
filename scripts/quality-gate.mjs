export function evaluateQuality(report, expectedIds) {
  const failures = [];
  if (report.mode !== "live") failures.push("live_evaluation_missing");
  const cases = Array.isArray(report.cases) ? report.cases : [];
  if (
    new Set(cases.map((c) => c.id)).size !== cases.length ||
    cases.length !== expectedIds.length ||
    !expectedIds.every((id) => cases.some((c) => c.id === id))
  )
    failures.push("incomplete_corpus");
  for (const item of cases) {
    if (
      !item.metrics ||
      !Number.isFinite(item.metrics.precision) ||
      !Number.isFinite(item.metrics.recall) ||
      item.metrics.precision < 0.95 ||
      item.metrics.recall < 0.9
    )
      failures.push(`quality:${item.id}`);
    if (!["concluido", "revisao_manual"].includes(item.status)) failures.push(`failed:${item.id}`);
    if (item.review_expected && item.review_matched !== true) failures.push(`review:${item.id}`);
  }
  return { passed: failures.length === 0, failures };
}
