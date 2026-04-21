/**
 * AuthGuard – wraps protected routes.
 * Redirects unauthenticated users to "/" (login page).
 * Shows a brief loading state while the session is resolving.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import type { Session } from "../../lib/supabase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setSession(null);
      return;
    }

    // Get current session immediately
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) navigate("/");
    });

    // Listen for auth state changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) navigate("/");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!SUPABASE_CONFIGURED) return <>{children}</>;

  // Loading state — brief flicker prevention
  if (session === undefined) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "0.9rem",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </path>
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  if (!session) return null; // Redirecting

  return <>{children}</>;
}
