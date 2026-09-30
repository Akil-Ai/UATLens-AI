import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydsllsrijanrwxvcoosx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2xsc3JpamFucnd4dmNvb3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MDczMTEsImV4cCI6MjEwNjI4MzMxMX0.15YjwaC0p8UtjuHaPQbhZPImiQQungtZSQZ84Yrg9nw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Sets auth cookie so middleware and API requests can read the token.
 */
export function setAuthCookies(accessToken: string, refreshToken?: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `uatlens_auth=true; path=/; max-age=${maxAge}; SameSite=Lax`;
  if (refreshToken) {
    document.cookie = `sb-refresh-token=${refreshToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

/**
 * Clears auth cookies upon signout.
 */
export function clearAuthCookies() {
  if (typeof document === "undefined") return;
  document.cookie = "sb-access-token=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "sb-refresh-token=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "uatlens_auth=; path=/; max-age=0; SameSite=Lax";
}

/**
 * Retrieves the current access token for authenticated API requests.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) {
    setAuthCookies(data.session.access_token, data.session.refresh_token);
    return data.session.access_token;
  }
  // Fallback to cookie if present
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/sb-access-token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

// Automatically sync session state to cookies on state changes
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      setAuthCookies(session.access_token, session.refresh_token);
    } else if (event === "SIGNED_OUT") {
      clearAuthCookies();
    }
  });
}
