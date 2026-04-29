import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/format";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Pause, Play, X, CreditCard, Lock, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Receipt, ReceiptData, printReceipt } from "@/components/Receipt";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Category { id: string; name: string; }
interface Product { id: string; name: string; price: number; category_id: string | null; image_url: string | null; }

const POS = () => {
  const { user } = useAuth();
  const { canDiscount, canCancel, canOverridePrice, isAdmin } = usePermissions();
  const cart = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [restaurant, setRestaurant] = useState<any>(null);

  // Price override dialog
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");

  useEffect(() => { (async () => {
    const [cats, prods, settings] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order").order("name"),
      supabase.from("products").select("*").eq("active", true).order("name"),
      supabase.from("settings").select("*").maybeSingle(),
    ]);
    setCategories(cats.data || []);
    setProducts((prods.data || []) as Product[]);
    if (settings.data) {
      setRestaurant(settings.data);
      setAutoPrint(!!settings.data.auto_print);
    }
  })(); }, []);

  const filtered = useMemo(() => {
    let p = products;
    if (activeCat) p = p.filter((x) => x.category_id === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      p = p.filter((x) => x.name.toLowerCase().includes(q));
    }
    return p;
  }, [products, activeCat, search]);

  const tryRemove = (id: string) => {
    if (!canCancel) { toast.error("Removing items requires permission"); return; }
    cart.remove(id);
  };

  const openPriceEdit = (id: string, current: number) => {
    if (!canOverridePrice) { toast.error("Price override not allowed"); return; }
    setPriceEditId(id);
    setPriceInput(String(current));
  };
  const savePriceEdit = () => {
    const v = parseFloat(priceInput);
    if (isNaN(v) || v < 0) { toast.error("Invalid price"); return; }
    if (priceEditId) cart.setPrice(priceEditId, v);
    setPriceEditId(null);
    toast.success("Price updated");
  };

  const checkout = async (data: { splits: any[]; customerId: string | null; customerName: string; customerPhone: string }) => {
    if (!cart.items.length) return;
    try {
      let customerId = data.customerId;
      const dueAmount = data.splits.filter((s) => s.method === "due").reduce((sum, s) => sum + Number(s.amount || 0), 0);

      if (!customerId && (data.customerName.trim() || data.customerPhone.trim())) {
        const { data: nc, error: ce } = await supabase
          .from("customers")
          .insert({ name: data.customerName.trim() || "Walk-in", phone: data.customerPhone.trim() || null })
          .select().single();
        if (ce) throw ce;
        customerId = nc.id;
      }

      const subtotal = cart.subtotal;
      const total = cart.total;
      const paid = data.splits.filter((s) => s.method !== "due").reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const status = dueAmount > 0 ? "due" : "completed";

      const { data: order, error: oerr } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId, table_number: cart.table || null,
          subtotal, total, paid_amount: paid, due_amount: dueAmount,
          status, cashier_id: user?.id,
          notes: cart.discount > 0 ? `Discount: ${fmtMoney(cart.discount)}` : null,
        })
        .select().single();
      if (oerr) throw oerr;

      const itemsPayload = cart.items.map((i) => ({
        order_id: order.id, product_id: i.product_id, product_name: i.name,
        unit_price: i.price, quantity: i.quantity, line_total: i.price * i.quantity,
      }));
      const { error: ierr } = await supabase.from("order_items").insert(itemsPayload);
      if (ierr) throw ierr;

      const paymentsPayload = data.splits.filter((s) => Number(s.amount) > 0).map((s) => ({
        order_id: order.id, method: s.method, amount: Number(s.amount),
      }));
      if (paymentsPayload.length) {
        const { error: perr } = await supabase.from("order_payments").insert(paymentsPayload);
        if (perr) throw perr;
      }

      if (customerId && dueAmount > 0) {
        const { data: cur } = await supabase.from("customers").select("due_balance").eq("id", customerId).single();
        await supabase.from("customers").update({ due_balance: Number(cur?.due_balance || 0) + dueAmount }).eq("id", customerId);
      }

      const r: ReceiptData = {
        order_number: order.order_number,
        created_at: order.created_at,
        items: itemsPayload.map((i) => ({ name: i.product_name, quantity: Number(i.quantity), unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
        subtotal, total,
        payments: paymentsPayload.map((p) => ({ method: p.method, amount: Number(p.amount) })),
        due: dueAmount,
        customer: customerId ? { name: data.customerName, phone: data.customerPhone } : undefined,
        table: cart.table || undefined,
        restaurant: restaurant ? { name: restaurant.restaurant_name, address: restaurant.address, phone: restaurant.phone, footer: restaurant.receipt_footer } : undefined,
      };
      setReceiptData(r);
      setPayOpen(false);
      cart.clear();
      toast.success(`Order #${order.order_number} placed`);
      if (autoPrint) printReceipt();
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    }
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col lg:flex-row gap-3 p-3 animate-fade-in">
      {/* Categories */}
      <div className="lg:w-44 shrink-0">
        <Card className="glass-card h-full p-2 overflow-auto">
          <button
            onClick={() => setActiveCat(null)}
            className={`w-full text-left p-3 rounded-lg mb-1 text-sm font-medium transition ${!activeCat ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >All</button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`w-full text-left p-3 rounded-lg mb-1 text-sm font-medium transition ${activeCat === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >{c.name}</button>
          ))}
          {!categories.length && <p className="text-xs text-muted-foreground p-3">No categories. Add some in Categories or Inventory.</p>}
        </Card>
      </div>

      {/* Products */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products…" className="pl-9 h-11" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => cart.add({ id: p.id, name: p.name, price: Number(p.price) })}
                className="pos-tile p-3 text-left flex flex-col gap-2"
              >
                <div className="aspect-square rounded-lg bg-muted overflow-hidden">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>}
                </div>
                <div className="font-medium text-sm leading-tight line-clamp-2">{p.name}</div>
                <div className="text-primary font-bold">{fmtMoney(p.price)}</div>
              </button>
            ))}
            {!filtered.length && <p className="col-span-full text-center text-muted-foreground py-12">No products. Import via Inventory page.</p>}
          </div>
        </div>
      </div>

      {/* Cart */}
      <div className="lg:w-96 shrink-0">
        <Card className="glass-card h-full flex flex-col">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <span className="font-semibold">Cart</span>
            <Badge variant="secondary" className="ml-auto">{cart.items.length}</Badge>
            {isAdmin && <Badge variant="outline" className="text-xs border-primary/40 text-primary">Admin</Badge>}
          </div>

          <div className="p-3 grid grid-cols-2 gap-2 border-b border-border">
            <Input placeholder="Table #" value={cart.table} onChange={(e) => cart.setTable(e.target.value)} maxLength={10} />
            <Input placeholder="Customer name" value={cart.customerName} onChange={(e) => cart.setCustomer(null, e.target.value)} maxLength={50} />
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-2">
            {!cart.items.length && (
              <div className="text-center text-muted-foreground py-12 text-sm">Cart is empty</div>
            )}
            {cart.items.map((it) => (
              <div key={it.product_id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {fmtMoney(it.price)}
                    {canOverridePrice && (
                      <button onClick={() => openPriceEdit(it.product_id, it.price)} className="hover:text-primary" title="Override price">
                        <Pencil className="w-3 h-3 inline" />
                      </button>
                    )}
                    × {it.quantity} = <span className="text-primary font-semibold">{fmtMoney(it.price * it.quantity)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cart.setQty(it.product_id, it.quantity - 1)}><Minus className="w-3 h-3" /></Button>
                  <span className="w-6 text-center text-sm">{it.quantity}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cart.setQty(it.product_id, it.quantity + 1)}><Plus className="w-3 h-3" /></Button>
                  <Button
                    size="icon" variant="ghost"
                    className={`h-7 w-7 ${canCancel ? "text-destructive" : "text-muted-foreground/50"}`}
                    onClick={() => tryRemove(it.product_id)}
                    title={canCancel ? "Remove" : "Removing requires permission"}
                  >
                    {canCancel ? <Trash2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoney(cart.subtotal)}</span></div>

            {/* Discount row */}
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                Discount {!canDiscount && <Lock className="w-3 h-3" />}
              </span>
              <Input
                type="number" step="0.01" min="0"
                disabled={!canDiscount}
                value={cart.discount || ""}
                onChange={(e) => cart.setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-24 h-8 text-right"
                placeholder="0.00"
              />
            </div>

            <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{fmtMoney(cart.total)}</span></div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={cart.hold} disabled={!cart.items.length}>
                <Pause className="w-3 h-3 mr-1" /> Hold
              </Button>
              <Button variant="outline" size="sm" onClick={() => setHeldOpen(true)}>
                <Play className="w-3 h-3 mr-1" /> Held ({cart.held.length})
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!canCancel || !cart.items.length}
                onClick={() => { if (confirm("Clear cart?")) cart.clear(); }}
                title={canCancel ? "Clear cart" : "Requires permission"}
              >
                {canCancel ? <X className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />} Clear
              </Button>
            </div>

            <Button
              className="w-full h-12 text-base bg-gradient-emerald"
              disabled={!cart.items.length}
              onClick={() => setPayOpen(true)}
            >
              <CreditCard className="w-5 h-5 mr-2" /> Pay {fmtMoney(cart.total)}
            </Button>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
              Auto-print receipt after payment
            </label>
          </div>
        </Card>
      </div>

      <PaymentDialog
        open={payOpen} onOpenChange={setPayOpen}
        total={cart.total}
        customerId={cart.customerId} customerName={cart.customerName}
        onConfirm={checkout}
      />

      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Held Orders</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {!cart.held.length && <p className="text-sm text-muted-foreground text-center py-6">No held orders</p>}
            {cart.held.map((h) => {
              const total = h.items.reduce((s, i) => s + i.price * i.quantity, 0);
              return (
                <div key={h.id} className="border border-border rounded-lg p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{h.customer_name || "Walk-in"} {h.table && `· Table ${h.table}`}</div>
                    <div className="text-xs text-muted-foreground">{h.items.length} items · {fmtMoney(total)}</div>
                  </div>
                  <Button size="sm" onClick={() => { cart.resume(h.id); setHeldOpen(false); }}>Resume</Button>
                  <Button size="sm" variant="ghost" onClick={() => cart.removeHeld(h.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Price override dialog */}
      <Dialog open={!!priceEditId} onOpenChange={(v) => !v && setPriceEditId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Override price</DialogTitle></DialogHeader>
          <div>
            <Label>New unit price ($)</Label>
            <Input type="number" step="0.01" min="0" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPriceEditId(null)}>Cancel</Button>
            <Button onClick={savePriceEdit} className="bg-gradient-emerald">Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptData} onOpenChange={(v) => !v && setReceiptData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {receiptData && (
            <>
              <div className="bg-white text-black rounded-lg max-h-[60vh] overflow-auto">
                <Receipt data={receiptData} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setReceiptData(null)}>Close</Button>
                <Button onClick={printReceipt} className="bg-gradient-emerald">Print</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
