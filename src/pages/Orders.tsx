import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, fmtMoney, PAYMENT_LABELS, PAYMENT_COLORS, STATUS_COLORS } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt as ReceiptIcon, Search, Printer } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Receipt, ReceiptData, printReceipt } from "@/components/Receipt";
import { toast } from "sonner";

const STATUSES = ["pending", "preparing", "completed", "cancelled", "due"] as const;

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, customers(name, phone), order_items(*), order_payments(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders(data || []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const reprint = async (o: any) => {
    const { data: settings } = await supabase.from("settings").select("*").maybeSingle();
    setReceipt({
      order_number: o.order_number,
      created_at: o.created_at,
      items: o.order_items.map((i: any) => ({ name: i.product_name, quantity: Number(i.quantity), unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
      subtotal: Number(o.subtotal),
      total: Number(o.total),
      payments: o.order_payments.map((p: any) => ({ method: p.method, amount: Number(p.amount) })),
      due: Number(o.due_amount),
      customer: o.customers ? { name: o.customers.name, phone: o.customers.phone } : undefined,
      table: o.table_number,
      restaurant: settings ? { name: settings.restaurant_name, address: settings.address, phone: settings.phone, footer: settings.receipt_footer } : undefined,
    });
  };

  const filtered = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter((o) => !search || String(o.order_number).includes(search) || o.customers?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm">All orders, status & receipts</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by # or customer" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((o) => (
          <Card key={o.id} className="glass-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">#{o.order_number}</div>
                <div className="text-sm font-medium">{o.customers?.name || "Walk-in"} {o.table_number && <span className="text-muted-foreground">· T{o.table_number}</span>}</div>
                <div className="text-[11px] text-muted-foreground">{fmtDateTime(o.created_at)}</div>
              </div>
              <Badge variant="outline" className={STATUS_COLORS[o.status]}>{o.status}</Badge>
            </div>
            <div className="text-xs space-y-0.5 max-h-24 overflow-auto">
              {o.order_items.map((i: any) => (
                <div key={i.id} className="flex justify-between"><span className="truncate">{i.quantity}× {i.product_name}</span><span>{fmtMoney(i.line_total)}</span></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {o.order_payments.map((p: any) => (
                <Badge key={p.id} variant="outline" className={PAYMENT_COLORS[p.method]}>{PAYMENT_LABELS[p.method]} {fmtMoney(p.amount)}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm">
                <span className="text-muted-foreground">Total:</span> <span className="font-bold">{fmtMoney(o.total)}</span>
                {Number(o.due_amount) > 0 && <span className="ml-2 text-pay-due text-xs">Due: {fmtMoney(o.due_amount)}</span>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => reprint(o)}><Printer className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "preparing")}>Preparing</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "completed")}>Complete</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "cancelled")}>Cancel</Button>
            </div>
          </Card>
        ))}
        {!filtered.length && (
          <Card className="glass-card p-10 text-center text-muted-foreground col-span-full">
            <ReceiptIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            No orders found.
          </Card>
        )}
      </div>

      <Dialog open={!!receipt} onOpenChange={(v) => !v && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {receipt && (
            <>
              <div className="bg-white text-black rounded-lg max-h-[60vh] overflow-auto">
                <Receipt data={receipt} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
                <Button onClick={printReceipt} className="bg-gradient-emerald">Print</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
