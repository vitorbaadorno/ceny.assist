import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchCities, cityById } from "./cities";

// Versioned public IBGE snapshot: no credentials, provider calls or typed-query disclosure.
export const suggestCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ input: z.string().trim().min(2).max(100), sessionToken: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => searchCities(data.input));

export const resolveCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ placeId: z.string().regex(/^ibge:\d{7}$/), sessionToken: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => cityById(data.placeId));
