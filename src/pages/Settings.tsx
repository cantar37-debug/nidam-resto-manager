import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { ShieldCheck, Lock } from "lucide-react";

interface StaffRow {
  id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  user_roles: { role: string }[];
}

const Settings = () => {
  const { role, user } = useAuth();
  const perms = usePermissions();
  const [s, setS] = useState<any>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const load = async () => {
    const [st, p, r] = await Promise.all([
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("id, username, full_name, phone"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setS(st.data);
    const roleMap = new Map<string, string>();
    (r.data || []).forEach((row: any) => roleMap.set(row.user_id, row.role));
    const rows: StaffRow[] = (p.data || []).map((u: any) => ({
      id: u.id, username: u.username, full_name: u.full_name, phone: u.phone,
      user_roles: roleMap.has(u.id) ? [{ role: roleMap.get(u.id)! }] : [],
    }));
    setStaff(rows);
  };
  useEffect(() => { load(); }, []);

  const adminCount = staff.filter((u) => u.user_roles.some((r) => r.role === "admin")).length;

  const save = async () => {
    const { error } = await supabase.from("settings").update({
      restaurant_name: s.restaurant_name, address: s.address, phone: s.phone,
      receipt_footer: s.receipt_footer, auto_print: s.auto_print, currency: s.currency, tax_rate: s.tax_rate,
    }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const setUserRole = async (u: StaffRow, newRole: "admin" | "cashier") => {
    const currentRole = u.user_roles[0]?.role;
    if (currentRole === newRole) return;

    // Safeguard: prevent removing the last admin
    if (currentRole === "admin" && newRole !== "admin" && adminCount <= 1) {
      toast.error("Cannot demote the last admin. Promote another user first.");
      return;
    }
    // Safeguard: prevent self-demotion if last admin
    if (u.id === user?.id && currentRole === "admin" && newRole !== "admin" && adminCount <= 1) {
      toast.error("You are the only admin — promote someone else before demoting yourself.");
      return;
    }
    if (!confirm(`Change ${u.full_name || u.username}'s role to ${newRole}?`)) return;

    // Delete existing roles for this user, then insert the new one
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", u.id);
    if (delErr) { toast.error(delErr.message); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: u.id, role: newRole as any });
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Role updated");
    load();
  };

  if (role === null) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (role !== "admin") return <div className="p-6">Admin only.</div>;
  if (!s) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Restaurant info, receipts, permissions & staff</p>
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

      {/* Cashier Permissions */}
      <Card className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Cashier Permissions</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Toggle abilities for cashier accounts. Admins always have full control. Settings are stored locally on this device.
        </p>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Allow Discounts</Label>
              <p className="text-xs text-muted-foreground">Cashiers can apply discounts at checkout</p>
            </div>
            <Switch
              checked={perms.allowDiscount}
              onCheckedChange={(v) => perms.setPermissions({ allowDiscount: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Allow Order Cancellation</Label>
              <p className="text-xs text-muted-foreground">Cashiers can void orders and remove cart items</p>
            </div>
            <Switch
              checked={perms.allowCancel}
              onCheckedChange={(v) => perms.setPermissions({ allowCancel: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Allow Price Override</Label>
              <p className="text-xs text-muted-foreground">Cashiers can change product prices at checkout</p>
            </div>
            <Switch
              checked={perms.allowPriceOverride}
              onCheckedChange={(v) => perms.setPermissions({ allowPriceOverride: v })}
            />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">Staff & Roles</h3>
        <p className="text-xs text-muted-foreground">
          {adminCount} admin{adminCount !== 1 && "s"} · The system always keeps at least one admin.
        </p>
        <div className="space-y-2">
          {staff.map((u) => {
            const userRole = u.user_roles[0]?.role || "—";
            const isMe = u.id === user?.id;
            const isLastAdmin = userRole === "admin" && adminCount <= 1;
            return (
              <div key={u.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{u.full_name || u.username} {isMe && <span className="text-xs text-primary">(you)</span>}</div>
                  <div className="text-xs text-muted-foreground truncate">@{u.username} · {u.phone || "no phone"}</div>
                </div>
                <Badge variant="outline" className={userRole === "admin" ? "border-primary/40 text-primary" : ""}>
                  {userRole}
                </Badge>
                {userRole === "cashier" && (
                  <Button size="sm" variant="outline" onClick={() => setUserRole(u, "admin")}>Make admin</Button>
                )}
                {userRole === "admin" && (
                  <Button
                    size="sm" variant="outline"
                    disabled={isLastAdmin}
                    onClick={() => setUserRole(u, "cashier")}
                    title={isLastAdmin ? "Cannot demote the last admin" : "Demote to cashier"}
                  >
                    {isLastAdmin ? <><Lock className="w-3 h-3 mr-1" />Locked</> : "Make cashier"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          To add a cashier: have them sign up via the Web Login tab.
          For POS PIN access, set their password to <code className="bg-muted px-1 rounded">pos-XXXX</code> (XXXX = 4-digit PIN), with their phone set on the profile.
        </p>
      </Card>
    </div>
  );
};

export default Settings;
