import { fmtMoney, PAYMENT_LABELS } from "@/lib/format";

export interface ReceiptData {
  order_number: number;
  created_at: string;
  items: { name: string; quantity: number; unit_price: number; line_total: number }[];
  subtotal: number;
  total: number;
  payments: { method: string; amount: number }[];
  due: number;
  customer?: { name?: string; phone?: string };
  table?: string;
  restaurant?: { name: string; address?: string; phone?: string; footer?: string };
}

export const Receipt = ({ data }: { data: ReceiptData }) => {
  const r = data.restaurant;
  return (
    <div id="print-receipt" className="p-3 text-sm leading-tight">
      <div className="text-center mb-2">
        <div className="font-bold text-base">{r?.name || "NIDAM Restaurant"}</div>
        {r?.address && <div className="text-[11px]">{r.address}</div>}
        {r?.phone && <div className="text-[11px]">Tel: {r.phone}</div>}
      </div>
      <div className="border-t border-b border-dashed py-1 my-2 text-[11px]">
        <div className="flex justify-between"><span>Order #</span><span>{data.order_number}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{new Date(data.created_at).toLocaleString()}</span></div>
        {data.table && <div className="flex justify-between"><span>Table</span><span>{data.table}</span></div>}
        {data.customer?.name && <div className="flex justify-between"><span>Customer</span><span>{data.customer.name}</span></div>}
        {data.customer?.phone && <div className="flex justify-between"><span>Phone</span><span>{data.customer.phone}</span></div>}
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-dashed">
            <th className="text-left">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Price</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i}>
              <td className="text-left">{it.name}</td>
              <td className="text-right">{it.quantity}</td>
              <td className="text-right">{fmtMoney(it.unit_price)}</td>
              <td className="text-right">{fmtMoney(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed mt-2 pt-2 text-[12px] space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(data.subtotal)}</span></div>
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{fmtMoney(data.total)}</span></div>
      </div>
      <div className="border-t border-dashed mt-2 pt-2 text-[11px] space-y-0.5">
        <div className="font-semibold">Payment</div>
        {data.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{PAYMENT_LABELS[p.method] || p.method}</span>
            <span>{fmtMoney(p.amount)}</span>
          </div>
        ))}
        {data.due > 0 && (
          <div className="flex justify-between font-bold mt-1">
            <span>** DUE BALANCE **</span><span>{fmtMoney(data.due)}</span>
          </div>
        )}
      </div>
      <div className="text-center mt-3 text-[11px]">
        {r?.footer || "Thank you! Powered by Blue Flag"}
      </div>
    </div>
  );
};

export const printReceipt = () => {
  setTimeout(() => window.print(), 100);
};
