import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./useAuth";

export interface CashierPermissions {
  allowDiscount: boolean;
  allowCancel: boolean;
  allowPriceOverride: boolean;
}

const DEFAULTS: CashierPermissions = {
  allowDiscount: false,
  allowCancel: false,
  allowPriceOverride: false,
};

const KEY = "nidam_cashier_permissions";

interface Ctx extends CashierPermissions {
  isAdmin: boolean;
  // Effective permission checks (admin always true)
  canDiscount: boolean;
  canCancel: boolean;
  canOverridePrice: boolean;
  setPermissions: (p: Partial<CashierPermissions>) => void;
}

const PermissionsContext = createContext<Ctx | null>(null);

const load = (): CashierPermissions => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
};

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { role } = useAuth();
  const [perms, setPerms] = useState<CashierPermissions>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(perms));
  }, [perms]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setPerms(load());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const isAdmin = role === "admin";
  const value: Ctx = {
    ...perms,
    isAdmin,
    canDiscount: isAdmin || perms.allowDiscount,
    canCancel: isAdmin || perms.allowCancel,
    canOverridePrice: isAdmin || perms.allowPriceOverride,
    setPermissions: (p) => setPerms((cur) => ({ ...cur, ...p })),
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used inside PermissionsProvider");
  return ctx;
};
