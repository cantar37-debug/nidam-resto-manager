import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const AppLayout = () => {
  const { session, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!session) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30 px-4">
            <SidebarTrigger />
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
              NIDAM POS · Restaurant Management
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
            Powered by <span className="text-primary font-semibold">Blue Flag</span>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};
