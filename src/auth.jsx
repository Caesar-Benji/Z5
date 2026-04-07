import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data, error } = await supabase
      .from("profiles").select("*").eq("id", userId).single();
    if (error) { setProfile(null); return; }
    setProfile(data);
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
    <AuthCtx.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
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
    case "sniper":       return "SNIPER";
    default:             return (role || "").toUpperCase();
  }
}

export function canManageSquads(role) {
  return role === "admin" || role === "officer";
}

export function canCreateInvites(role) {
  return role === "admin" || role === "officer" || role === "squad_leader";
}
