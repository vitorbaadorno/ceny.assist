import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import type { Database } from "./database.ts";
export type { Json } from "./database.ts";
export type WorkerContext = {
  supabase: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
  userId: string;
};
