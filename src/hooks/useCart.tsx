import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface HeldOrder {
  id: string;
  items: CartItem[];
  table?: string;
  customer_id?: string;
  customer_name?: string;
  created_at: string;
}

interface CartContextValue {
  items: CartItem[];
  table: string;
  customerId: string | null;
  customerName: string;
  add: (p: { id: string; name: string; price: number }) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, q: number) => void;
  setTable: (t: string) => void;
  setCustomer: (id: string | null, name: string) => void;
  clear: () => void;
  hold: () => void;
  resume: (id: string) => void;
  removeHeld: (id: string) => void;
  held: HeldOrder[];
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const HELD_KEY = "nidam_held_orders";
const CART_KEY = "nidam_active_cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
  });
  const [table, setTable] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [held, setHeld] = useState<HeldOrder[]>(() => {
    try { return JSON.parse(localStorage.getItem(HELD_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(HELD_KEY, JSON.stringify(held)); }, [held]);

  const add: CartContextValue["add"] = (p) => setItems((cur) => {
    const ex = cur.find((i) => i.product_id === p.id);
    if (ex) return cur.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
    return [...cur, { product_id: p.id, name: p.name, price: p.price, quantity: 1 }];
  });
  const remove = (id: string) => setItems((cur) => cur.filter((i) => i.product_id !== id));
  const setQty = (id: string, q: number) => setItems((cur) => q <= 0
    ? cur.filter((i) => i.product_id !== id)
    : cur.map((i) => i.product_id === id ? { ...i, quantity: q } : i));
  const setCustomer = (id: string | null, name: string) => { setCustomerId(id); setCustomerName(name); };
  const clear = () => { setItems([]); setTable(""); setCustomerId(null); setCustomerName(""); };
  const hold = () => {
    if (!items.length) return;
    setHeld((cur) => [...cur, {
      id: crypto.randomUUID(), items, table,
      customer_id: customerId ?? undefined, customer_name: customerName,
      created_at: new Date().toISOString(),
    }]);
    clear();
  };
  const resume = (id: string) => {
    const h = held.find((o) => o.id === id);
    if (!h) return;
    setItems(h.items); setTable(h.table || ""); setCustomerId(h.customer_id || null); setCustomerName(h.customer_name || "");
    setHeld((cur) => cur.filter((o) => o.id !== id));
  };
  const removeHeld = (id: string) => setHeld((cur) => cur.filter((o) => o.id !== id));

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, table, customerId, customerName,
      add, remove, setQty, setTable, setCustomer,
      clear, hold, resume, removeHeld, held, subtotal,
    }}>{children}</CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};
