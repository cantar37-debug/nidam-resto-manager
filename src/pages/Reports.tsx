import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, PAYMENT_LABELS } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const Reports = () => {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const [o, e] = await Promise.all([
      supabase.from("orders").select("*, order_payments(*), order_items(*)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59")
        .neq("status", "cancelled"),
      supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to),
    ]);
    setOrders(o.data || []); setExpenses(e.data || []);
  })(); }, [from, to]);

  const totalSales = useMemo(() => orders.reduce((s, o) => s + Number(o.paid_amount), 0), [orders]);
  const totalDue = useMemo(() => orders.reduce((s, o) => s + Number(o.due_amount), 0), [orders]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const profit = totalSales - totalExpenses;

  const byMethod = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => o.order_payments.forEach((p: any) => {
      map[p.method] = (map[p.method] || 0) + Number(p.amount);
    }));
    return Object.entries(map).map(([method, amount]) => ({ name: PAYMENT_LABELS[method], amount }));
  }, [orders]);

  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const d = o.created_at.slice(0, 10);
      map[d] = (map[d] || 0) + Number(o.paid_amount);
    });
    return Object.entries(map).sort().map(([d, v]) => ({ day: d.slice(5), sales: v }));
  }, [orders]);

  const COLORS = ["hsl(var(--pay-cash))", "hsl(var(--pay-evc))", "hsl(var(--pay-edahab))", "hsl(var(--pay-premier))", "hsl(var(--pay-due))"];

  const exportXlsx = () => {
    const rows = orders.map((o) => ({
      "Order #": o.order_number, Date: o.created_at, Status: o.status,
      Subtotal: o.subtotal, Total: o.total, Paid: o.paid_amount, Due: o.due_amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    const sumRows = [
      { Metric: "Total Sales", Value: totalSales },
      { Metric: "Total Due", Value: totalDue },
      { Metric: "Total Expenses", Value: totalExpenses },
      { Metric: "Net Profit", Value: profit },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), "Summary");
    XLSX.writeFile(wb, `nidam-report-${from}-to-${to}.xlsx`);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Reports</h1>
          <p className="text-muted-foreground text-sm">Performance & profitability</p>
        </div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button variant="outline" onClick={exportXlsx}><Download className="w-4 h-4 mr-1" />Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="stat-card"><p className="text-xs uppercase text-muted-foreground">Sales</p><p className="text-2xl font-bold text-success">{fmtMoney(totalSales)}</p></Card>
        <Card className="stat-card"><p className="text-xs uppercase text-muted-foreground">Outstanding Due</p><p className="text-2xl font-bold text-pay-due">{fmtMoney(totalDue)}</p></Card>
        <Card className="stat-card"><p className="text-xs uppercase text-muted-foreground">Expenses</p><p className="text-2xl font-bold text-pay-edahab">{fmtMoney(totalExpenses)}</p></Card>
        <Card className="stat-card"><p className="text-xs uppercase text-muted-foreground">Net Profit</p><p className={`text-2xl font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney(profit)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="glass-card p-4">
          <h3 className="font-semibold mb-3">Sales by day</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDay}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="glass-card p-4">
          <h3 className="font-semibold mb-3">Payment methods</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byMethod} dataKey="amount" nameKey="name" outerRadius={100} label={(e) => e.name}>
                {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
