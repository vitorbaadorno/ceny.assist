import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function connectorHeaders(extra?: Record<string, string>) {
  const lovableKey = process.env["LOVABLE_API_KEY"]!;
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"]!;
  if (!lovableKey || !mapsKey) throw new Error("A conexão com o Google Maps não está disponível.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    ...extra,
  };
}

async function throwMapsError(response: Response): Promise<never> {
  const body = await response.text();
  if (response.status === 403) {
    throw new Error("O Google Maps recusou a consulta. Verifique as permissões da conexão.");
  }
  if (response.status === 429) {
    throw new Error("O limite temporário de consultas de cidades foi atingido.");
  }
  throw new Error(`Não foi possível consultar cidades (${response.status}): ${body}`);
}

export const suggestCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ input: z.string().trim().min(2).max(100), sessionToken: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: connectorHeaders({
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      }),
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        includedPrimaryTypes: ["(cities)"],
        includedRegionCodes: ["br"],
        languageCode: "pt-BR",
        regionCode: "BR",
      }),
    });
    if (!response.ok) return throwMapsError(response);
    const payload = (await response.json()) as {
      suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }>;
    };
    return (payload.suggestions ?? [])
      .map((item) => ({
        placeId: item.placePrediction?.placeId ?? "",
        label: item.placePrediction?.text?.text ?? "",
      }))
      .filter((item) => item.placeId && item.label)
      .slice(0, 5);
  });

export const resolveCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ placeId: z.string().min(1).max(300), sessionToken: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const url = new URL(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}`);
    url.searchParams.set("sessionToken", data.sessionToken);
    url.searchParams.set("languageCode", "pt-BR");
    url.searchParams.set("regionCode", "BR");
    const response = await fetch(url, {
      headers: connectorHeaders({ "X-Goog-FieldMask": "displayName,addressComponents" }),
    });
    if (!response.ok) return throwMapsError(response);
    const payload = (await response.json()) as {
      displayName?: { text?: string };
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    };
    const components = payload.addressComponents ?? [];
    const city =
      components.find((part) => part.types?.includes("administrative_area_level_2"))?.longText ??
      components.find((part) => part.types?.includes("locality"))?.longText ??
      payload.displayName?.text;
    const state = components.find((part) => part.types?.includes("administrative_area_level_1"))?.shortText;
    if (!city) throw new Error("Não foi possível identificar a cidade selecionada.");
    return { city: state ? `${city} - ${state}` : city };
  });