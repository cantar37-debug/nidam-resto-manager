import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Receipt, Package, Wallet,
  BarChart3, Users, Settings, ChefHat, LogOut, FolderTree,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, role: "any" as const },
  { title: "POS", url: "/pos", icon: ShoppingCart, role: "any" as const },
  { title: "Orders", url: "/orders", icon: Receipt, role: "any" as const },
  { title: "Inventory", url: "/inventory", icon: Package, role: "admin" as const },
  { title: "Categories", url: "/categories", icon: FolderTree, role: "admin" as const },
  { title: "Expenses", url: "/expenses", icon: Wallet, role: "admin" as const },
  { title: "Sales Reports", url: "/reports", icon: BarChart3, role: "admin" as const },
  { title: "Customers", url: "/customers", icon: Users, role: "any" as const },
  { title: "Settings", url: "/settings", icon: Settings, role: "admin" as const },
];

export const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role, signOut, user } = useAuth();

  // Show admin items while role is loading (null) or when admin; hide only for confirmed cashier
  const visible = items.filter((i) => i.role === "any" || role !== "cashier");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-emerald flex items-center justify-center shadow-[var(--shadow-glow)] shrink-0">
            <ChefHat className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold tracking-tight truncate">NIDAM POS</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{role || "staff"}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="text-xs text-muted-foreground truncate px-2">{user.email}</div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
          <LogOut className="w-4 h-4" />
          {!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
