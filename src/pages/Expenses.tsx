import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Download, Trash2, Wallet, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const DAILY_CATS = ["Meat", "Fish", "Vegetables", "Drinks", "Gas", "Transport", "Small purchases"];
const MONTHLY_CATS = ["Salary", "Rent", "Internet", "Water", "Electricity", "Taxes", "Maintenance"];

const Expenses = () => {
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [salesMonth, setSalesMonth] = useState(0);

  const [title, setTitle] = useState(""); const [category, setCategory] = useState(DAILY_CATS[0]);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const load = async () => {
    const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    setExpenses(data || []);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { data: o } = await supabase.from("orders").select("paid_amount, status").gte("created_at", monthStart.toISOString());
    setSalesMonth((o || []).filter((x) => x.status !== "cancelled").reduce((s, x) => s + Number(x.paid_amount), 0));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => expenses.filter((e) => e.period === period), [expenses, period]);
  const totalMonth = useMemo(() => {
    const s = new Date(); s.setDate(1); s.setHours(0, 0, 0, 0);
    return expenses.filter((e) => new Date(e.expense_date) >= s).reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses]);
  const netProfit = salesMonth - totalMonth;

  const save = async () => {
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt)) { toast.error("Title & amount required"); return; }
    const { error } = await supabase.from("expenses").insert({
      title: title.trim(), category, amount: amt, expense_date: date, period, notes: notes || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Added"); setOpen(false); setTitle(""); setAmount(""); setNotes(""); load(); }
  };

  const del = async (id: string) => { if (!confirm("Delete?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const exportXlsx = () => {
    const rows = filtered.map((e) => ({ Date: e.expense_date, Title: e.title, Category: e.category, Amount: e.amount, Notes: e.notes || "" }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `nidam-expenses-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const cats = period === "daily" ? DAILY_CATS : MONTHLY_CATS;

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track daily & monthly costs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportXlsx}><Download className="w-4 h-4 mr-1" />Export</Button>
          <Button onClick={() => { setCategory(cats[0]); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add expense</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="stat-card"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-muted-foreground">Sales (Month)</p><p className="text-2xl font-bold">{fmtMoney(salesMonth)}</p></div><TrendingUp className="w-6 h-6 text-success" /></div></Card>
        <Card className="stat-card"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-muted-foreground">Expenses (Month)</p><p className="text-2xl font-bold">{fmtMoney(totalMonth)}</p></div><Wallet className="w-6 h-6 text-pay-edahab" /></div></Card>
        <Card className="stat-card"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-muted-foreground">Net Profit</p><p className={`text-2xl font-bold ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney(netProfit)}</p></div><TrendingUp className={`w-6 h-6 ${netProfit >= 0 ? "text-success" : "text-destructive"}`} /></div></Card>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="monthly">Monthly</TabsTrigger></TabsList>
        <TabsContent value={period}>
          <Card className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="text-left p-3">Date</th><th className="text-left p-3">Title</th><th className="text-left p-3">Category</th><th className="text-right p-3">Amount</th><th></th></tr></thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">{fmtDate(e.expense_date)}</td>
                    <td className="p-3">{e.title}{e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}</td>
                    <td className="p-3 text-muted-foreground">{e.category}</td>
                    <td className="p-3 text-right font-semibold">{fmtMoney(e.amount)}</td>
                    <td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => del(e.id)}><Trash2 className="w-4 h-4" /></Button></td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No {period} expenses yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add {period} expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Category</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>Amount ($)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
