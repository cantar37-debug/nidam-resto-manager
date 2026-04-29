import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Settings = () => {
  const { role } = useAuth();
  const [s, setS] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);

  const load = async () => {
    const [st, p] = await Promise.all([
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("id, username, full_name, phone, user_roles(role)"),
    ]);
    setS(st.data); setStaff(p.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await supabase.from("settings").update({
      restaurant_name: s.restaurant_name, address: s.address, phone: s.phone,
      receipt_footer: s.receipt_footer, auto_print: s.auto_print, currency: s.currency, tax_rate: s.tax_rate,
    }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  if (role === null) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (role !== "admin") return <div className="p-6">Admin only.</div>;
  if (!s) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Restaurant info, receipts & staff</p>
      </div>

      <Card className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">Restaurant</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={s.restaurant_name} onChange={(e) => setS({ ...s, restaurant_name: e.target.value })} maxLength={80} /></div>
          <div><Label>Phone</Label><Input value={s.phone || ""} onChange={(e) => setS({ ...s, phone: e.target.value })} maxLength={30} /></div>
        </div>
        <div><Label>Address</Label><Input value={s.address || ""} onChange={(e) => setS({ ...s, address: e.target.value })} maxLength={200} /></div>
        <div><Label>Receipt footer</Label><Input value={s.receipt_footer || ""} onChange={(e) => setS({ ...s, receipt_footer: e.target.value })} maxLength={200} /></div>
        <div className="flex items-center gap-3">
          <Switch checked={s.auto_print} onCheckedChange={(v) => setS({ ...s, auto_print: v })} />
          <Label>Auto-print receipts after payment</Label>
        </div>
        <Button onClick={save} className="bg-gradient-emerald">Save settings</Button>
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">Staff</h3>
        <p className="text-xs text-muted-foreground">
          To add a cashier: have them sign up via the Web Login tab (first user is admin, the rest become cashiers).
          For POS PIN access, set their password to <code className="bg-muted px-1 rounded">pos-XXXX</code> where XXXX is their 4-digit PIN, and ensure their phone is set on their profile.
        </p>
        <div className="space-y-1">
          {staff.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
              <div>
                <div className="font-medium">{u.full_name || u.username}</div>
                <div className="text-xs text-muted-foreground">@{u.username} · {u.phone || "no phone"}</div>
              </div>
              <Badge variant="outline">{u.user_roles?.[0]?.role || "—"}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Settings;
