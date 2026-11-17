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
    const label = expectedIds.includes(item.id) ? item.id : "unexpected_case";
    if (
      !item.metrics ||
      !Number.isFinite(item.metrics.precision) ||
      !Number.isFinite(item.metrics.recall) ||
      item.metrics.precision > 1 ||
      item.metrics.recall > 1 ||
      item.metrics.precision < 0.95 ||
      item.metrics.recall < 0.9
    )
      failures.push(`quality:${label}`);
    if (!["concluido", "revisao_manual"].includes(item.status)) failures.push(`failed:${label}`);
    if (item.review_expected && item.review_matched !== true) failures.push(`review:${label}`);
  }
  return { passed: failures.length === 0, failures };
}
