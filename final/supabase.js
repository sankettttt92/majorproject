import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Check your .env file and restart the Expo dev server."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We're a native app, not a web app handling OAuth redirects
    detectSessionInUrl: false,
  },
});

/**
 * Supabase phone auth expects E.164 format, e.g. +14155551234
 * This does a best-effort normalization for a country code + local number.
 */
export function toE164(countryCode, localNumber) {
  const digitsOnly = (localNumber || "").replace(/\D/g, "");
  const code = (countryCode || "+1").replace(/[^\d+]/g, "");
  return `${code}${digitsOnly}`;
}