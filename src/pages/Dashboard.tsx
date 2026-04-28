import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import {
  DollarSign, ShoppingCart, Clock, AlertTriangle,
  Wallet, TrendingUp, Receipt, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  salesToday: number;
  salesMonth: number;
  ordersToday: number;
  pending: number;
  totalDue: number;
  lowStock: number;
  expensesMonth: number;
  netProfit: number;
}

const Dashboard = () => {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [todayOrders, monthOrders, pending, customers, lowStock, expenses] = await Promise.all([
      supabase.from("orders").select("total, paid_amount, status, created_at").gte("created_at", todayStart.toISOString()),
      supabase.from("orders").select("total, paid_amount").gte("created_at", monthStart.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "preparing"]),
      supabase.from("customers").select("due_balance"),
      supabase.from("inventory_items").select("id, quantity, low_stock_threshold"),
      supabase.from("expenses").select("amount").gte("expense_date", monthStart.toISOString().slice(0, 10)),
    ]);

    const salesToday = (todayOrders.data || []).filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.paid_amount || 0), 0);
    const salesMonth = (monthOrders.data || []).reduce((sum, o) => sum + Number(o.paid_amount || 0), 0);
    const totalDue = (customers.data || []).reduce((sum, c) => sum + Number(c.due_balance || 0), 0);
    const lowStockCount = (lowStock.data || []).filter((i) => Number(i.quantity) <= Number(i.low_stock_threshold)).length;
    const expensesMonth = (expenses.data || []).reduce((sum, e) => sum + Number(e.amount), 0);

    setS({
      salesToday,
      salesMonth,
      ordersToday: (todayOrders.data || []).length,
      pending: pending.count ?? 0,
      totalDue,
      lowStock: lowStockCount,
      expensesMonth,
      netProfit: salesMonth - expensesMonth,
    });
  };

  const widgets = s ? [
    { label: "Sales Today", value: fmtMoney(s.salesToday), icon: DollarSign, color: "text-success", bg: "bg-success/10" },
    { label: "Sales This Month", value: fmtMoney(s.salesMonth), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Orders Today", value: s.ordersToday.toString(), icon: ShoppingCart, color: "text-info", bg: "bg-info/10" },
    { label: "Pending Orders", value: s.pending.toString(), icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Total Due", value: fmtMoney(s.totalDue), icon: Receipt, color: "text-pay-due", bg: "bg-pay-due/10" },
    { label: "Low Stock Alerts", value: s.lowStock.toString(), icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Expenses (Month)", value: fmtMoney(s.expensesMonth), icon: Wallet, color: "text-pay-edahab", bg: "bg-pay-edahab/10" },
    { label: "Net Profit (Month)", value: fmtMoney(s.netProfit), icon: TrendingUp, color: s.netProfit >= 0 ? "text-success" : "text-destructive", bg: s.netProfit >= 0 ? "bg-success/10" : "bg-destructive/10" },
  ] : [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of today's restaurant performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {!s && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        {widgets.map((w) => (
          <Card key={w.label} className="stat-card group hover:border-primary/50 transition-all">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{w.label}</p>
                <p className="text-2xl font-bold">{w.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${w.bg} flex items-center justify-center`}>
                <w.icon className={`w-5 h-5 ${w.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
