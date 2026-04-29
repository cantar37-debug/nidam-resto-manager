import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Upload, Download, Edit, Trash2, Package, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface Product { id: string; name: string; price: number; category_id: string | null; image_url: string | null; active: boolean; }
interface Category { id: string; name: string; }

const Inventory = () => {
  const { isAdmin } = usePermissions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("menu");
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<any[]>([]);

  // product editor
  const [prodOpen, setProdOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pname, setPname] = useState(""); const [pprice, setPprice] = useState("");
  const [pcat, setPcat] = useState(""); const [pimg, setPimg] = useState("");

  // inventory editor
  const [invOpen, setInvOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<any | null>(null);
  const [iname, setIname] = useState(""); const [iqty, setIqty] = useState(""); const [ilow, setIlow] = useState(""); const [iunit, setIunit] = useState("pcs"); const [icost, setIcost] = useState("");

  // import preview
  const [preview, setPreview] = useState<any[] | null>(null);

  const load = async () => {
    const [p, c, i] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("inventory_items").select("*").order("name"),
    ]);
    setProducts((p.data || []) as Product[]); setCats(c.data || []); setItems(i.data || []);
  };
  useEffect(() => { load(); }, []);

  const openProd = (p?: Product) => {
    setEditing(p || null);
    setPname(p?.name || ""); setPprice(p ? String(p.price) : "");
    setPcat(p?.category_id || ""); setPimg(p?.image_url || "");
    setProdOpen(true);
  };
  const saveProd = async () => {
    const price = parseFloat(pprice);
    if (!pname.trim() || isNaN(price)) { toast.error("Name & price required"); return; }
    const payload = { name: pname.trim(), price, category_id: pcat || null, image_url: pimg || null };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) toast.error(error.message); else { toast.success("Saved"); setProdOpen(false); load(); }
  };
  const delProd = async (id: string) => { if (!confirm("Delete product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const openInv = (i?: any) => {
    setEditingInv(i || null);
    setIname(i?.name || ""); setIqty(i ? String(i.quantity) : "0");
    setIlow(i ? String(i.low_stock_threshold) : "5"); setIunit(i?.unit || "pcs");
    setIcost(i ? String(i.cost_per_unit) : "0");
    setInvOpen(true);
  };
  const saveInv = async () => {
    if (!iname.trim()) { toast.error("Name required"); return; }
    const payload = { name: iname.trim(), quantity: parseFloat(iqty) || 0, low_stock_threshold: parseFloat(ilow) || 0, unit: iunit, cost_per_unit: parseFloat(icost) || 0 };
    const { error } = editingInv
      ? await supabase.from("inventory_items").update(payload).eq("id", editingInv.id)
      : await supabase.from("inventory_items").insert(payload);
    if (error) toast.error(error.message); else { toast.success("Saved"); setInvOpen(false); load(); }
  };
  const delInv = async (id: string) => { if (!confirm("Delete?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws);
    const cleaned = rows.map((r) => ({
      category: String(r.Category || r.category || "").trim(),
      name: String(r.Product || r.Name || r["Product Name"] || r.name || "").trim(),
      price: parseFloat(r.Price || r.price || 0),
      image_url: r["Image URL"] || r.image_url || r.Image || null,
    })).filter((r) => r.name && !isNaN(r.price));
    if (!cleaned.length) { toast.error("No valid rows found"); return; }
    setPreview(cleaned);
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!preview) return;
    const catNames = Array.from(new Set(preview.map((p) => p.category).filter(Boolean)));
    // Ensure categories
    const catMap = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
    for (const n of catNames) {
      if (!catMap.has(n.toLowerCase())) {
        const { data, error } = await supabase.from("categories").insert({ name: n }).select().single();
        if (!error && data) catMap.set(n.toLowerCase(), data.id);
      }
    }
    const payload = preview.map((r) => ({
      name: r.name, price: r.price,
      category_id: r.category ? catMap.get(r.category.toLowerCase()) || null : null,
      image_url: r.image_url || null,
    }));
    const { error } = await supabase.from("products").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(`Imported ${payload.length} products`); setPreview(null); load(); }
  };

  const exportXlsx = () => {
    const rows = products.map((p) => ({
      Category: cats.find((c) => c.id === p.category_id)?.name || "",
      "Product Name": p.name, Price: p.price, "Image URL": p.image_url || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Menu");
    XLSX.writeFile(wb, `nidam-menu-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory & Menu</h1>
          <p className="text-muted-foreground text-sm">Manage products, categories and stock items</p>
        </div>
        {!isAdmin && (
          <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only (cashier)</Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="menu">Menu (Products)</TabsTrigger>
          <TabsTrigger value="stock">Stock Items</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openProd()} disabled={!isAdmin}><Plus className="w-4 h-4 mr-1" />Add Product</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!isAdmin}><Upload className="w-4 h-4 mr-1" />Import Excel</Button>
            <Button variant="outline" onClick={exportXlsx}><Download className="w-4 h-4 mr-1" />Export Excel</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
          </div>

          <Card className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-3">Product</th><th className="text-left p-3">Category</th><th className="text-right p-3">Price</th><th className="text-right p-3"></th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{cats.find((c) => c.id === p.category_id)?.name || "—"}</td>
                    <td className="p-3 text-right font-semibold text-primary">{fmtMoney(p.price)}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => openProd(p)} disabled={!isAdmin}><Edit className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => delProd(p.id)} disabled={!isAdmin}><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">No products. Import an Excel file or add one.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-3">
          <Button onClick={() => openInv()} disabled={!isAdmin}><Plus className="w-4 h-4 mr-1" />Add Stock Item</Button>
          <Card className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-3">Item</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Low</th><th className="text-right p-3">Cost</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const low = Number(i.quantity) <= Number(i.low_stock_threshold);
                  return (
                    <tr key={i.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 flex items-center gap-2">{low && <AlertTriangle className="w-4 h-4 text-destructive" />}{i.name}</td>
                      <td className="p-3 text-right">{i.quantity} {i.unit}{low && <Badge variant="outline" className="ml-2 bg-destructive/15 text-destructive border-destructive/30">LOW</Badge>}</td>
                      <td className="p-3 text-right text-muted-foreground">{i.low_stock_threshold}</td>
                      <td className="p-3 text-right">{fmtMoney(i.cost_per_unit)}</td>
                      <td className="p-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openInv(i)} disabled={!isAdmin}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => delInv(i.id)} disabled={!isAdmin}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
                {!items.length && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2 opacity-40" />No stock items.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={pname} onChange={(e) => setPname(e.target.value)} /></div>
            <div><Label>Price ($)</Label><Input type="number" step="0.01" value={pprice} onChange={(e) => setPprice(e.target.value)} /></div>
            <div><Label>Category</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={pcat} onChange={(e) => setPcat(e.target.value)}>
                <option value="">— None —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><Label>Image URL</Label><Input value={pimg} onChange={(e) => setPimg(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setProdOpen(false)}>Cancel</Button><Button onClick={saveProd}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingInv ? "Edit" : "Add"} stock item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={iname} onChange={(e) => setIname(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Quantity</Label><Input type="number" step="0.01" value={iqty} onChange={(e) => setIqty(e.target.value)} /></div>
              <div><Label>Unit</Label><Input value={iunit} onChange={(e) => setIunit(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Low threshold</Label><Input type="number" step="0.01" value={ilow} onChange={(e) => setIlow(e.target.value)} /></div>
              <div><Label>Cost / unit</Label><Input type="number" step="0.01" value={icost} onChange={(e) => setIcost(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setInvOpen(false)}>Cancel</Button><Button onClick={saveInv}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import Preview ({preview?.length} rows)</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr><th className="text-left p-2">Category</th><th className="text-left p-2">Product</th><th className="text-right p-2">Price</th></tr></thead>
              <tbody>
                {preview?.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-border"><td className="p-2">{r.category}</td><td className="p-2">{r.name}</td><td className="p-2 text-right">{fmtMoney(r.price)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button><Button onClick={confirmImport}>Import {preview?.length} products</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
