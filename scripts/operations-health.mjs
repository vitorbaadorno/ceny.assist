export function evaluateHealth(snapshot, limits = {}) {
  const alerts = [];
  const thresholds = { queue_age_minutes: 15, erasure_age_minutes: 30, failure_rate: 0.2, min_attempts: 5, ...limits };
  if (snapshot.reachable !== true) alerts.push("service_unavailable");
  for (const key of ["stuck_jobs", "stuck_erasures", "repeated_failures", "blocked_jobs"])
    if (!Number.isSafeInteger(snapshot[key]) || snapshot[key] < 0) alerts.push("monitor_incomplete");
    else if (snapshot[key] > 0) alerts.push(key);
  if (snapshot.attempts >= thresholds.min_attempts && snapshot.failures / snapshot.attempts >= thresholds.failure_rate)
    alerts.push("ai_failure_rate");
  if (snapshot.ledger_age_minutes == null || snapshot.ledger_age_minutes > 15) alerts.push("ledger_stale");
  if (snapshot.budget_exceeded === true) alerts.push("budget_exceeded");
  return { healthy: alerts.length === 0, alerts: [...new Set(alerts)] };
}

// Service credential stays in the external runner; only exact counts leave Supabase.
export async function collectHealth(admin, now = new Date()) {
  const ago = minutes => new Date(+now - minutes * 60000).toISOString();
  const count = async query => {
    const { count, error } = await query;
    if (error || !Number.isSafeInteger(count)) throw new Error("Monitoramento indisponível.");
    return count;
  };
  const [stuck_jobs, stuck_erasures, repeated_failures, blocked_jobs, attempts, failures] = await Promise.all([
    count(admin.from("resume_jobs").select("id", { count: "exact", head: true }).in("state", ["queued", "running", "retry_wait"]).lt("updated_at", ago(15))),
    count(admin.from("privacy_erasure_operations").select("id", { count: "exact", head: true }).neq("state", "completed").lt("created_at", ago(30))),
    count(admin.from("resume_jobs").select("id", { count: "exact", head: true }).gte("attempts", 3).in("state", ["failed", "retry_wait"]).gte("updated_at", ago(60))),
    count(admin.from("resume_jobs").select("id", { count: "exact", head: true }).eq("state", "blocked")),
    count(admin.from("resume_job_attempts").select("job_id", { count: "exact", head: true }).gte("started_at", ago(60))),
    count(admin.from("resume_job_attempts").select("job_id", { count: "exact", head: true }).not("outcome", "in", "(running,succeeded,review)").gte("started_at", ago(60))),
  ]);
  return { stuck_jobs, stuck_erasures, repeated_failures, blocked_jobs, attempts, failures };
}
