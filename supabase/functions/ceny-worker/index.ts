import { handleRequest } from "../_shared/worker-handler.ts";
Deno.serve(handleRequest);
