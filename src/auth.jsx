import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setProfileError(null); return; }
    setProfileError(null);
    try {
      // Race the query against a timeout so the supabase client can never
      // leave us hanging forever (observed in the wild with stale tokens).
      const queryPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("profile query timeout")), 6000)
      );
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (error) {
        console.error("loadProfile error", error);
        setProfile(null);
        setProfileError(error.message || "Failed to load profile");
        return;
      }
      if (!data) {
        setProfile(null);
        setProfileError("No profile row found for this account");
        return;
      }
      setProfile(data);
    } catch (e) {
      console.error("loadProfile threw", e);
      setProfile(null);
      setProfileError(e?.message || String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Hard safety: if anything below stalls (stale refresh token, network
    // hiccup, etc.), never leave the user looking at "Booting terminal…"
    // forever. Force the loading state off after 4s no matter what.
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) throw error;
        setSession(data.session);
        if (data.session?.user) {
          try { await loadProfile(data.session.user.id); }
          catch (e) { console.warn("loadProfile failed", e); }
        }
      } catch (e) {
        console.warn("getSession failed", e);
        // Wipe any corrupt local session so next reload starts clean.
        try { await supabase.auth.signOut(); } catch {}
        setSession(null);
        setProfile(null);
      } finally {
        if (!cancelled) {
          clearTimeout(safety);
          setLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      if (cancelled) return;
      setSession(sess);
      if (sess?.user) {
        try { await loadProfile(sess.user.id); }
        catch (e) { console.warn("loadProfile (auth change) failed", e); }
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ session, profile, profileError, loading, refreshProfile, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function roleLabel(role) {
  switch (role) {
    case "admin":        return "ADMIN";
    case "officer":      return "TEAM OFFICER";
    case "squad_leader": return "SQUAD LEADER";
    case "instructor":   return "INSTRUCTOR";
    case "sniper":       return "SNIPER";
    default:             return (role || "").toUpperCase();
  }
}

export function isInstructor(role) {
  return role === "instructor";
}

export function canManageSquads(role) {
  return role === "admin" || role === "officer";
}

export function canCreateInvites(role) {
  return role === "admin" || role === "officer" || role === "squad_leader";
}

// Who can author an admin task with no specific squad ("whole team").
export function canCreateWholeTeamTask(role) {
  return role === "admin" || role === "officer";
}
