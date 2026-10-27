// Explicit opt-in only. Never invoked by normal tests or CI with real AI credentials.
import { extractResume } from "../supabase/functions/_shared/resumes.ts";
import { MODEL } from "../supabase/functions/_shared/ai.ts";
import { PROMPT_VERSION } from "../supabase/functions/_shared/extraction-prompt.ts";
import { measureExtraction } from "./quality-metrics.mjs";
const manifest = JSON.parse(await Deno.readTextFile("tests/fixtures/quality/manifest.json"));
const live = Deno.args.includes("--live");
if (live && !Deno.env.get("LOVABLE_API_KEY"))
  throw new Error("Configure a credencial de IA no ambiente seguro antes da avaliação real.");
const report: { mode: string; model: string; prompt_version: string; cases: unknown[] } = {
  mode: live ? "live" : "not_run",
  model: MODEL,
  prompt_version: PROMPT_VERSION,
  cases: [],
};
for (const item of manifest.cases) {
  if (!live) {
    report.cases.push({
      id: item.id,
      format: item.format,
      challenge: item.challenge,
      status: "not_run",
      precision: null,
      recall: null,
    });
    continue;
  }
  const started = performance.now();
  let usage;
  try {
    const result = await extractResume(
      await Deno.readFile(`tests/fixtures/quality/${item.file}`),
      item.file,
      AbortSignal.timeout(120000),
      (receipt) => {
        usage = receipt;
      },
    );
    report.cases.push({
      id: item.id,
      format: item.format,
      challenge: item.challenge,
      status: result.status,
      duration_ms: Math.round(performance.now() - started),
      usage,
      metrics: measureExtraction(result.extraction, item.expected),
      review_expected: item.review_expected,
      review_matched: !item.review_expected || result.status === "revisao_manual",
    });
  } catch {
    report.cases.push({
      id: item.id,
      format: item.format,
      challenge: item.challenge,
      status: "failed",
      duration_ms: Math.round(performance.now() - started),
      usage,
    });
  }
}
console.log(JSON.stringify(report, null, 2));
