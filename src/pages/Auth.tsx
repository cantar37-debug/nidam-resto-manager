import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ChefHat } from "lucide-react";
import { z } from "zod";

const webSchema = z.object({
  username: z.string().trim().min(2).max(50),
  password: z.string().min(6).max(72),
});

const Auth = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // web login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // pos login state
  const [posPhone, setPosPhone] = useState("");
  const [pin, setPin] = useState("");

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (session) return <Navigate to="/" replace />;

  const emailFromUsername = (u: string) => `${u.toLowerCase().trim()}@nidam.pos`;

  const handleWeb = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = webSchema.safeParse({ username, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const email = emailFromUsername(username);
      if (signupMode) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username, full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created. Signing in…");
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate("/");
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    } finally { setBusy(false); }
  };

  const handlePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) { toast.error("PIN must be 4 digits"); return; }
    if (posPhone.trim().length < 6) { toast.error("Enter a valid phone"); return; }
    setBusy(true);
    try {
      // PIN is stored as the password for POS users; lookup profile by phone to find email
      const { data: prof, error } = await supabase
        .from("profiles").select("id, phone, username").eq("phone", posPhone.trim()).maybeSingle();
      if (error) throw error;
      if (!prof) throw new Error("No staff with that phone");
      const email = emailFromUsername(prof.username || prof.id);
      // POS login uses the same password — we treat PIN+phone as a shortcut for cashiers whose password equals "pos-<pin>"
      const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: `pos-${pin}` });
      if (e2) throw new Error("Invalid PIN");
      navigate("/pos");
    } catch (err: any) {
      toast.error(err.message ?? "POS login failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/20">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-emerald shadow-[var(--shadow-glow)] mb-4">
            <ChefHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">NIDAM POS</h1>
          <p className="text-muted-foreground text-sm mt-1">Restaurant Management System</p>
        </div>

        <Card className="glass-card p-6">
          <Tabs defaultValue="web">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="web">Web Login</TabsTrigger>
              <TabsTrigger value="pos">POS Login</TabsTrigger>
            </TabsList>

            <TabsContent value="web">
              <form onSubmit={handleWeb} className="space-y-4">
                {signupMode && (
                  <>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="+252…" />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {signupMode ? "Create Admin Account" : "Sign in"}
                </Button>
                <button type="button" onClick={() => setSignupMode((v) => !v)}
                  className="w-full text-xs text-muted-foreground hover:text-primary transition">
                  {signupMode ? "Back to sign in" : "First time? Create account (first user becomes Admin)"}
                </button>
              </form>
            </TabsContent>

            <TabsContent value="pos">
              <form onSubmit={handlePos} className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input type="tel" value={posPhone} onChange={(e) => setPosPhone(e.target.value)} placeholder="+252 …" required />
                </div>
                <div className="space-y-2">
                  <Label>4-digit PIN</Label>
                  <Input
                    type="password" inputMode="numeric" maxLength={4}
                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.5em]"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base" disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enter POS
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Cashier PINs are set by the admin in Settings.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">Powered by Blue Flag</p>
      </div>
    </div>
  );
};

export default Auth;
