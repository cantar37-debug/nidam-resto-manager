import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtMoney, PAYMENT_LABELS } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Banknote, Smartphone, CreditCard, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Method = "cash" | "evc_plus" | "e_dahab" | "premier_wallet" | "due";

interface Split { method: Method; amount: number; reference?: string; }
interface Customer { id: string; name: string; phone: string | null; }

const METHOD_ICONS: Record<Method, any> = {
  cash: Banknote, evc_plus: Smartphone, e_dahab: Smartphone, premier_wallet: CreditCard, due: Clock,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  customerId: string | null;
  customerName: string;
  onConfirm: (data: { splits: Split[]; customerId: string | null; customerName: string; customerPhone: string }) => void;
}

export const PaymentDialog = ({ open, onOpenChange, total, customerId, customerName, onConfirm }: Props) => {
  const [splits, setSplits] = useState<Split[]>([{ method: "cash", amount: total }]);
  const [custName, setCustName] = useState(customerName);
  const [custPhone, setCustPhone] = useState("");
  const [custId, setCustId] = useState<string | null>(customerId);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (!open) return;
    setSplits([{ method: "cash", amount: total }]);
    setCustName(customerName);
    setCustId(customerId);
    setCustPhone("");
    supabase.from("customers").select("id, name, phone").order("name").then(({ data }) => setCustomers(data || []));
  }, [open, total, customerId, customerName]);

  const paid = useMemo(() => splits.reduce((s, x) => s + (Number(x.amount) || 0), 0), [splits]);
  const dueIncluded = splits.some((s) => s.method === "due");
  const remaining = total - paid;

  const update = (i: number, patch: Partial<Split>) =>
    setSplits((cur) => cur.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const addSplit = () => {
    const usedMethods = new Set(splits.map((s) => s.method));
    const next = (["cash", "evc_plus", "e_dahab", "premier_wallet", "due"] as Method[]).find((m) => !usedMethods.has(m));
    if (!next) return;
    setSplits((cur) => [...cur, { method: next, amount: Math.max(0, total - paid) }]);
  };

  const submit = () => {
    if (Math.abs(paid - total) > 0.01) { toast.error("Payment total must equal order total"); return; }
    if (dueIncluded && !custName.trim()) { toast.error("Customer name required for Due"); return; }
    if (dueIncluded && !custPhone.trim() && !custId) { toast.error("Customer phone required for Due"); return; }
    onConfirm({ splits, customerId: custId, customerName: custName, customerPhone: custPhone });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment — {fmtMoney(total)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {splits.map((s, i) => {
            const Icon = METHOD_ICONS[s.method];
            return (
              <div key={i} className="flex gap-2 items-center">
                <select
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={s.method}
                  onChange={(e) => update(i, { method: e.target.value as Method })}
                >
                  {(Object.keys(PAYMENT_LABELS) as Method[]).map((m) => (
                    <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
                  ))}
                </select>
                <Input
                  type="number" step="0.01" min="0"
                  value={s.amount}
                  onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
                  className="w-32 text-right"
                />
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                {splits.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setSplits((cur) => cur.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}

          {splits.length < 5 && (
            <Button variant="outline" size="sm" onClick={addSplit} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add split payment
            </Button>
          )}

          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total</span><span className="font-semibold">{fmtMoney(total)}</span></div>
            <div className="flex justify-between"><span>Entered</span><span>{fmtMoney(paid)}</span></div>
            <div className={`flex justify-between font-semibold ${Math.abs(remaining) < 0.01 ? "text-success" : "text-destructive"}`}>
              <span>Difference</span><span>{fmtMoney(Math.abs(remaining))}</span>
            </div>
          </div>

          {dueIncluded && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="text-xs text-warning font-medium flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Due requires customer info
              </div>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={custId || ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setCustId(id);
                  const c = customers.find((x) => x.id === id);
                  if (c) { setCustName(c.name); setCustPhone(c.phone || ""); }
                }}
              >
                <option value="">— New customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Name</Label><Input value={custName} onChange={(e) => setCustName(e.target.value)} maxLength={80} /></div>
                <div><Label className="text-xs">Phone</Label><Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} maxLength={20} /></div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-emerald">Confirm Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
