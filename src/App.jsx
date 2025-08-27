import React, { useMemo, useRef, useState, useEffect } from "react";

const currencyFormatter = (code) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: code });

const fmt = (n, code = "PHP") => currencyFormatter(code).format(n);

const nowStr = () =>
  new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const sampleProducts = [
  { id: "BVG-001", name: "Bottled Water 500ml", price: 20, category: "Beverages", stock: 120, sku: "480000000001" },
  { id: "BVG-002", name: "Iced Tea 330ml", price: 35, category: "Beverages", stock: 80, sku: "480000000002" },
  { id: "SNK-001", name: "Potato Chips 60g", price: 55, category: "Snacks", stock: 60, sku: "480000000101" },
  { id: "SNK-002", name: "Chocolate Bar", price: 45, category: "Snacks", stock: 65, sku: "480000000102" },
  { id: "PRC-001", name: "Toothpaste 100g", price: 89, category: "Personal Care", stock: 50, sku: "480000000201" },
  { id: "GRC-001", name: "Rice 1kg", price: 68, category: "Grocery", stock: 200, sku: "480000000301" },
  { id: "GRC-002", name: "Eggs (dozen)", price: 120, category: "Grocery", stock: 30, sku: "480000000302" },
  { id: "GRC-003", name: "Cooking Oil 1L", price: 175, category: "Grocery", stock: 40, sku: "480000000303" },
];

export default function POSApp() {
  const [products] = useState(sampleProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);

  const [taxRate, setTaxRate] = useState(12);
  const [discountPct, setDiscountPct] = useState(0);
  const [currency, setCurrency] = useState("PHP");

  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashGiven, setCashGiven] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const receiptRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pos_settings") || "{}");
      if (saved.taxRate != null) setTaxRate(saved.taxRate);
      if (saved.discountPct != null) setDiscountPct(saved.discountPct);
      if (saved.currency) setCurrency(saved.currency);
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "pos_settings",
      JSON.stringify({ taxRate, discountPct, currency })
    );
  }, [taxRate, discountPct, currency]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const inCat = category === "All" || p.category === category;
      const inText =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      return inCat && inText;
    });
  }, [query, category, products]);

  const addToCart = (prod) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.id === prod.id);
      if (i >= 0) {
        const next = [...c];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...c, { id: prod.id, name: prod.name, price: prod.price, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    setCart((c) => c.map((x) => (x.id === id ? { ...x, qty: Math.max(1, qty) } : x)));
  };

  const removeFromCart = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const clearCart = () => setCart([]);

  const { subtotal, discountAmt, taxAmt, grandTotal } = useMemo(() => {
    const sub = cart.reduce((acc, x) => acc + x.price * x.qty, 0);
    const d = (sub * (Number(discountPct) || 0)) / 100;
    const txbl = Math.max(0, sub - d);
    const t = (txbl * (Number(taxRate) || 0)) / 100;
    return { subtotal: sub, discountAmt: d, taxAmt: t, grandTotal: txbl + t };
  }, [cart, taxRate, discountPct]);

  const change = useMemo(() => {
    if (paymentMethod !== "Cash") return 0;
    const cg = Number(cashGiven) - (grandTotal || 0);
    return Math.max(0, Math.round(cg * 100) / 100);
  }, [cashGiven, grandTotal, paymentMethod]);

  const handleScan = (e) => {
    e.preventDefault();
    const val = scannerRef.current?.value?.trim();
    if (!val) return;
    const p = products.find(
      (x) => x.sku === val || x.id.toLowerCase() === val.toLowerCase()
    );
    if (p) addToCart(p);
    scannerRef.current.value = "";
  };

  const canCheckout =
    cart.length > 0 &&
    (paymentMethod !== "Cash" || Number(cashGiven) >= grandTotal);

  const completeSale = () => {
    const receipt = {
      id: `OR-${Date.now()}`,
      time: nowStr(),
      items: cart.map((x) => ({ ...x })),
      subtotal,
      discountPct: Number(discountPct) || 0,
      discountAmt,
      taxRate: Number(taxRate) || 0,
      taxAmt,
      total: grandTotal,
      paymentMethod,
      cashGiven: paymentMethod === "Cash" ? Number(cashGiven) : null,
      change: paymentMethod === "Cash" ? change : null,
      currency,
    };
    setLastReceipt(receipt);
    setShowCheckout(false);
    clearCart();
    setCashGiven(0);
    setTimeout(() => printReceipt(), 50);
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;
    const w = window.open("", "_blank", "width=480,height=640");
    const html = `<!doctype html><html><head><meta charset='utf-8' />
      <title>Receipt</title>
      <style>
        *{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
        .center{text-align:center}
        .right{text-align:right}
        .muted{color:#555}
        table{width:100%;border-collapse:collapse}
        td{padding:2px 0}
        hr{border:0;border-top:1px dashed #999;margin:8px 0}
      </style>
    </head><body>${receiptRef.current.innerHTML}</body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600" />
            <div>
              <h1 className="text-xl font-semibold">Simple POS</h1>
              <p className="text-xs text-slate-500">
                Single-file demo · {currency} · VAT {taxRate}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <label className="text-slate-500">VAT%</label>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-16 border rounded-lg px-2 py-1" min={0} max={30} />
              <label className="text-slate-500">Discount%</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="w-16 border rounded-lg px-2 py-1" min={0} max={100} />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border rounded-lg px-2 py-1">
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={!canCheckout}
              className={`px-4 py-2 rounded-xl text-white text-sm shadow ${canCheckout ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-300 cursor-not-allowed"}`}
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-3 grid sm:grid-cols-3 gap-2">
            <form onSubmit={(e) => e.preventDefault()} className="sm:col-span-2">
              <input type="text" placeholder="Search by name, ID, or SKU…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full border rounded-2xl px-4 py-2" />
            </form>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded-2xl px-4 py-2">
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <form onSubmit={handleScan} className="flex items-center gap-2">
              <input ref={scannerRef} type="text" placeholder="Quick add via SKU/ID (press Enter)" className="w-full border rounded-2xl px-4 py-2" />
              <button className="px-3 py-2 rounded-xl bg-slate-800 text-white text-sm">Add</button>
            </form>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left bg-white hover:shadow-md transition border border-slate-200 rounded-2xl p-3">
                <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl mb-3" />
                <div className="text-sm font-medium leading-tight line-clamp-2">{p.name}</div>
                <div className="text-xs text-slate-500">{p.category}</div>
                <div className="mt-2 font-semibold">{fmt(p.price, currency)}</div>
                <div className="text-[10px] text-slate-400 mt-1">ID: {p.id} · SKU: {p.sku}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">No products found.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Cart ({cart.reduce((a, x) => a + x.qty, 0)} items)</h2>
              <button onClick={clearCart} className="text-xs text-slate-500 hover:text-slate-700">Clear</button>
            </div>

            <div className="space-y-3 max-h-[52vh] overflow-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{item.name}</div>
                    <div className="text-xs text-slate-500">{fmt(item.price, currency)} each</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex items-center border rounded-xl overflow-hidden">
                        <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2 py-1 text-sm">−</button>
                        <input type="number" value={item.qty} onChange={(e) => updateQty(item.id, Number(e.target.value))} className="w-12 text-center text-sm py-1" min={1} />
                        <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2 py-1 text-sm">+</button>
                      </div>
                      <div className="ml-auto font-semibold">{fmt(item.price * item.qty, currency)}</div>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500">✕</button>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="text-center text-slate-500 py-8">Your cart is empty.</div>
              )}
            </div>

            <div className="my-4 border-t pt-3 space-y-1 text-sm">
              <Row label="Subtotal" value={fmt(subtotal, currency)} />
              <Row label={`Discount (${discountPct || 0}%)`} value={`− ${fmt(discountAmt, currency)}`} />
              <Row label={`Tax (${taxRate || 0}%)`} value={fmt(taxAmt, currency)} />
              <Row label="Total" value={fmt(grandTotal, currency)} bold />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-slate-600">Payment:</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="border rounded-xl px-3 py-1">
                  <option>Cash</option>
                  <option>Card</option>
                  <option>E-Wallet</option>
                </select>
              </div>
              {paymentMethod === "Cash" && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="block text-slate-500 mb-1">Cash Given</label>
                    <input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} className="w-full border rounded-xl px-3 py-2" min={0} />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Change</label>
                    <div className="w-full border rounded-xl px-3 py-2 bg-slate-50">{fmt(change, currency)}</div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowCheckout(true)}
                disabled={!canCheckout}
                className={`w-full mt-2 px-4 py-3 rounded-2xl text-white font-medium shadow ${
                  canCheckout ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Confirm Payment</h3>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-1 text-sm">
              <Row label="Total Due" value={fmt(grandTotal, currency)} bold />
              <Row label="Method" value={paymentMethod} />
              {paymentMethod === "Cash" && (
                <>
                  <Row label="Cash Given" value={fmt(Number(cashGiven) || 0, currency)} />
                  <Row label="Change" value={fmt(change, currency)} />
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowCheckout(false)} className="flex-1 px-4 py-2 rounded-xl border">Cancel</button>
              <button onClick={completeSale} disabled={!canCheckout} className={`flex-1 px-4 py-2 rounded-xl text-white ${canCheckout ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-300"}`}>Complete Sale</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {lastReceipt && (
          <div className="max-w-sm mx-auto" ref={receiptRef}>
            <div className="center">
              <div style={{ fontSize: 16, fontWeight: 700 }}>SIMPLE POS DEMO</div>
              <div className="muted">123 Demo St., Metro Manila</div>
              <div className="muted">TIN: 000-000-000-00000</div>
            </div>
            <hr />
            <div className="muted">OR: {lastReceipt.id}</div>
            <div className="muted">Date: {lastReceipt.time}</div>
            <hr />
            <table>
              <tbody>
                {lastReceipt.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.qty} × {it.name}</td>
                    <td className="right">{fmt(it.price * it.qty, lastReceipt.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr />
            <table>
              <tbody>
                <tr><td>Subtotal</td><td className="right">{fmt(lastReceipt.subtotal, lastReceipt.currency)}</td></tr>
                <tr><td>Discount ({lastReceipt.discountPct}%)</td><td className="right">− {fmt(lastReceipt.discountAmt, lastReceipt.currency)}</td></tr>
                <tr><td>VAT ({lastReceipt.taxRate}%)</td><td className="right">{fmt(lastReceipt.taxAmt, lastReceipt.currency)}</td></tr>
                <tr><td style={{ fontWeight: 700 }}>TOTAL</td><td className="right" style={{ fontWeight: 700 }}>{fmt(lastReceipt.total, lastReceipt.currency)}</td></tr>
              </tbody>
            </table>
            <hr />
            <div>Payment: {lastReceipt.paymentMethod}</div>
            {lastReceipt.paymentMethod === "Cash" && (
              <>
                <div>Cash: {fmt(lastReceipt.cashGiven || 0, lastReceipt.currency)}</div>
                <div>Change: {fmt(lastReceipt.change || 0, lastReceipt.currency)}</div>
              </>
            )}
            <hr />
            <div className="center">Thank you and come again!</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <div>{label}</div>
      <div>{value}</div>
    </div>
  );
}
