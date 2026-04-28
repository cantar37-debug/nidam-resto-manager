export const fmtMoney = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return `$${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  evc_plus: "EVC-Plus",
  e_dahab: "E-Dahab",
  premier_wallet: "Premier Wallet",
  due: "Due",
};

export const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-pay-cash/15 text-pay-cash border-pay-cash/30",
  evc_plus: "bg-pay-evc/15 text-pay-evc border-pay-evc/30",
  e_dahab: "bg-pay-edahab/15 text-pay-edahab border-pay-edahab/30",
  premier_wallet: "bg-pay-premier/15 text-pay-premier border-pay-premier/30",
  due: "bg-pay-due/15 text-pay-due border-pay-due/30",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-info/15 text-info border-info/30",
  preparing: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  due: "bg-pay-due/15 text-pay-due border-pay-due/30",
};
