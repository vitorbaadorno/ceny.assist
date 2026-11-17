export function evaluateRelease(evidence, commit, now = Date.now()) {
  const blocked = [];
  const items = Array.isArray(evidence?.items) ? evidence.items : [];
  for (let id = 1; id <= 20; id++) {
    const matches = items.filter((item) => item.id === id);
    const item = matches[0];
    const valid =
      matches.length === 1 &&
      item.status === "validated" &&
      typeof item.reference === "string" &&
      item.reference.trim().length >= 10 &&
      typeof item.approved_by === "string" &&
      item.approved_by.trim().length > 0 &&
      Number.isFinite(Date.parse(item.validated_at)) &&
      Date.parse(item.validated_at) <= now &&
      now - Date.parse(item.validated_at) < 30 * 86400000 &&
      item.commit === commit;
    if (!valid) blocked.push(id);
  }
  const p0 = blocked.some((id) => id <= 5),
    p1 = blocked.some((id) => id <= 11);
  return {
    // Missing P1 evidence is not a documented and monitored mitigation.
    verdict: p0 || p1 ? "NO-GO" : blocked.length ? "GO CONDICIONAL" : "GO",
    commercial_release: blocked.length === 0,
    blocked,
  };
}
