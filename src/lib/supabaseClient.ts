import { createClient } from "@supabase/supabase-js";

// This is Supabase's public anon key, protected by Row Level Security policies —
// safe to ship in the client bundle. Falls back to the literal so deployments
// work without extra env var configuration.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://dwgwjzmvsrhcpajqkcad.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_6VdHkQLOEzqP8RXBH0AvJQ_RFC6yait";

export const supabase = createClient(url, anonKey);
