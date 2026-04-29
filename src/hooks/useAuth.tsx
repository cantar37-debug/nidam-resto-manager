import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "cashier";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null, user: null, role: null, loading: true, signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string, attempts = 5) => {
    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (!error) {
        setRole((data?.role as Role) ?? null);
        return;
      }
      // transient backend error — wait and retry
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => { fetchRole(s.user.id); }, 0);
      } else {
        setRole(null);
      }
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) await fetchRole(s.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, role, loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
