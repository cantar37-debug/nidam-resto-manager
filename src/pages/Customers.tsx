import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, fmtDateTime, PAYMENT_LABELS } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Wallet, Search } from "lucide-react";
import { toast } from "sonner";

const Customers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [duePays, setDuePays] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState(""); const [payMethod, setPayMethod] = useState("cash");

  const load = async () => {
    const { data } = await supabase.from("customers").select("*").order("name");
    setCustomers(data || []);
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (c: any) => {
    setDetail(c);
    const [o, d] = await Promise.all([
      supabase.from("orders").select("*, order_payments(*)").eq("customer_id", c.id).order("created_at", { ascending: false }),
      supabase.from("due_payments").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }),
    ]);
    setOrders(o.data || []); setDuePays(d.data || []);
  };

  const addCustomer = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("customers").insert({ name: name.trim(), phone: phone.trim() || null });
    if (error) toast.error(error.message); else {
      toast.success("Customer added"); setName(""); setPhone(""); setAddOpen(false); load();
    }
  };

  const repay = async () => {
    if (!detail) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    if (amt > Number(detail.due_balance)) { toast.error("Exceeds due balance"); return; }
    const { error } = await supabase.from("due_payments").insert({ customer_id: detail.id, amount: amt, method: payMethod as any });
    if (error) { toast.error(error.message); return; }
    await supabase.from("customers").update({ due_balance: Number(detail.due_balance) - amt }).eq("id", detail.id);
    toast.success("Payment recorded"); setPayAmount("");
    load(); openDetail({ ...detail, due_balance: Number(detail.due_balance) - amt });
  };

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search));

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">Customer ledger & due balances</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search…" className="pl-9 w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <Card key={c.id} className="glass-card p-4 cursor-pointer hover:border-primary/50 transition" onClick={() => openDetail(c)}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.phone || "—"}</div>
              </div>
              {Number(c.due_balance) > 0 && (
                <Badge variant="outline" className="bg-pay-due/15 text-pay-due border-pay-due/30">
                  Due {fmtMoney(c.due_balance)}
                </Badge>
              )}
            </div>
          </Card>
        ))}
        {!filtered.length && <Card className="glass-card p-10 text-center text-muted-foreground col-span-full">No customers yet.</Card>}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addCustomer}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{detail?.name}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="font-semibold">{detail.phone || "—"}</div>
                </div>
                <div className="rounded-lg bg-pay-due/10 p-3">
                  <div className="text-xs text-muted-foreground">Outstanding Due</div>
                  <div className="font-bold text-pay-due text-xl">{fmtMoney(detail.due_balance)}</div>
                </div>
              </div>

              {Number(detail.due_balance) > 0 && (
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <div className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4" /> Record repayment</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Amount" type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    <select className="h-10 rounded-md border border-input bg-background px-2 text-sm col-span-1" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {Object.entries(PAYMENT_LABELS).filter(([k]) => k !== "due").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <Button onClick={repay}>Record</Button>
                  </div>
                </div>
              )}

              <div>
                <div className="font-semibold text-sm mb-2">Order history</div>
                <div className="max-h-40 overflow-auto space-y-1 text-xs">
                  {orders.map((o) => (
                    <div key={o.id} className="flex justify-between p-2 rounded bg-muted/30">
                      <span>#{o.order_number} · {fmtDateTime(o.created_at)}</span>
                      <span>{fmtMoney(o.total)} {Number(o.due_amount) > 0 && <span className="text-pay-due">(due {fmtMoney(o.due_amount)})</span>}</span>
                    </div>
                  ))}
                  {!orders.length && <p className="text-muted-foreground">No orders.</p>}
                </div>
              </div>

              <div>
                <div className="font-semibold text-sm mb-2">Repayment history</div>
                <div className="max-h-32 overflow-auto space-y-1 text-xs">
                  {duePays.map((p) => (
                    <div key={p.id} className="flex justify-between p-2 rounded bg-muted/30">
                      <span>{fmtDateTime(p.created_at)} · {PAYMENT_LABELS[p.method]}</span>
                      <span className="text-success">{fmtMoney(p.amount)}</span>
                    </div>
                  ))}
                  {!duePays.length && <p className="text-muted-foreground">No payments yet.</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
