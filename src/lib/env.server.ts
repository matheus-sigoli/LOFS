import "server-only";
import { z } from "zod";

// Segredos: só existem no servidor. `server-only` quebra o build se forem importados no cliente.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  FIRECRAWL_API_KEY: z.string().min(10).optional(),
});

let cache: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  cache ??= serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || undefined,
  });
  return cache;
}
