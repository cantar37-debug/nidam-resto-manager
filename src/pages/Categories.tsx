import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, FolderTree, Lock } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface Category { id: string; name: string; sort_order: number | null; }
interface Product { id: string; name: string; category_id: string | null; }

const Categories = () => {
  const { isAdmin } = usePermissions();
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  // Assign products dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCat, setAssignCat] = useState<Category | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    const [c, p] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order").order("name"),
      supabase.from("products").select("id, name, category_id").order("name"),
    ]);
    setCats(c.data || []); setProducts((p.data || []) as Product[]);
  };
  useEffect(() => { load(); }, []);

  if (!isAdmin) return (
    <div className="p-6 max-w-md mx-auto mt-12">
      <Card className="glass-card p-6 text-center space-y-2">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
        <h2 className="font-semibold">Admin only</h2>
        <p className="text-sm text-muted-foreground">Category management is restricted to administrators.</p>
      </Card>
    </div>
  );

  const openEditor = (c?: Category) => {
    setEditing(c || null);
    setName(c?.name || "");
    setSortOrder(c?.sort_order != null ? String(c.sort_order) : "");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const payload = { name: name.trim(), sort_order: sortOrder ? parseInt(sortOrder) : null };
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Renamed" : "Category added"); setOpen(false); load(); }
  };

  const del = async (c: Category) => {
    const count = products.filter((p) => p.category_id === c.id).length;
    const msg = count > 0
      ? `Delete "${c.name}"? ${count} product(s) will be uncategorised.`
      : `Delete "${c.name}"?`;
    if (!confirm(msg)) return;
    if (count > 0) {
      await supabase.from("products").update({ category_id: null }).eq("category_id", c.id);
    }
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const openAssign = (c: Category) => {
    setAssignCat(c);
    setSelected(new Set(products.filter((p) => p.category_id === c.id).map((p) => p.id)));
    setAssignOpen(true);
  };

  const saveAssign = async () => {
    if (!assignCat) return;
    const ids = Array.from(selected);
    const removeIds = products.filter((p) => p.category_id === assignCat.id && !selected.has(p.id)).map((p) => p.id);

    if (ids.length) await supabase.from("products").update({ category_id: assignCat.id }).in("id", ids);
    if (removeIds.length) await supabase.from("products").update({ category_id: null }).in("id", removeIds);

    toast.success("Products assigned");
    setAssignOpen(false);
    load();
  };

  const productCount = (catId: string) => products.filter((p) => p.category_id === catId).length;

  return (
    <div className="p-6 space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">Organise your menu into categories</p>
        </div>
        <Button onClick={() => openEditor()} className="bg-gradient-emerald">
          <Plus className="w-4 h-4 mr-1" /> Add Category
        </Button>
      </div>

      <Card className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-right p-3">Products</th>
              <th className="text-right p-3">Sort</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-right">
                  <Badge variant="outline">{productCount(c.id)}</Badge>
                </td>
                <td className="p-3 text-right text-muted-foreground">{c.sort_order ?? "—"}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openAssign(c)}>Assign</Button>
                  <Button size="icon" variant="ghost" onClick={() => openEditor(c)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {!cats.length && (
              <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">
                <FolderTree className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No categories yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Rename" : "Add"} category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus /></div>
            <div><Label>Sort order (optional)</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="e.g. 1" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-emerald">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Assign products to "{assignCat?.name}"</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-1">
            {products.map((p) => {
              const checked = selected.has(p.id);
              const otherCat = p.category_id && p.category_id !== assignCat?.id;
              return (
                <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox" checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(p.id); else next.delete(p.id);
                      setSelected(next);
                    }}
                  />
                  <span className="flex-1 text-sm">{p.name}</span>
                  {otherCat && (
                    <Badge variant="outline" className="text-xs">
                      {cats.find((c) => c.id === p.category_id)?.name || "other"}
                    </Badge>
                  )}
                </label>
              );
            })}
            {!products.length && <p className="text-sm text-muted-foreground p-6 text-center">No products yet.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={saveAssign} className="bg-gradient-emerald">Save assignments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Categories;
