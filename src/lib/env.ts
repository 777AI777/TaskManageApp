import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  AUTOMATION_CRON_SECRET: z.string().min(1).optional(),
});

type AppEnv = z.infer<typeof envSchema>;

let parsedEnv: AppEnv | null = null;

function parseEnv() {
  if (parsedEnv) {
    return parsedEnv;
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const readable = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment variables: ${readable}`);
  }
  parsedEnv = result.data;
  return parsedEnv;
}

export function getSupabaseEnv() {
  const env = parseEnv();
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getAutomationSecret() {
  const env = parseEnv();
  return env.AUTOMATION_CRON_SECRET;
}
