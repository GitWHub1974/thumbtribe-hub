import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.role as AppRole) ?? null;
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.warn("Auth loading timeout reached, forcing loading=false");
      if (mounted) setLoading(false);
    }, 3000);

    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        clearTimeout(timeout);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          try {
            const userRole = await fetchRole(newSession.user.id);
            if (mounted) setRole(userRole);
          } catch (e) {
            console.error("Failed to fetch role:", e);
          }
        } else {
          setRole(null);
        }
        if (mounted) setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      clearTimeout(timeout);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try {
          const userRole = await fetchRole(s.user.id);
          if (mounted) setRole(userRole);
        } catch (e) {
          console.error("Failed to fetch role:", e);
        }
      }
      if (mounted) setLoading(false);
    }).catch((err) => {
      console.error("getSession failed:", err);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
