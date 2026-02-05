import { createClient, SupabaseClient } from "@supabase/supabase-js";
import storage from "@src/utils/storage";

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://orjyevmxvecydcubskxf.supabase.co";
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yanlldm14dmVjeWRjdWJza3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDc3MzcsImV4cCI6MjA4MzgyMzczN30.9QY24A9yo9qcR2-GSZfrkBLBxWs9c8JAKHRxWo7NsMQ";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

