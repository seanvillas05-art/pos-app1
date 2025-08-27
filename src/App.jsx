import React, { useMemo, useRef, useState, useEffect } from "react";

/** CONFIG **/
const LOW_STOCK_THRESHOLD = 5;          // warn when stock <= this
const EXPIRY_SOON_DAYS = 30;            // warn when expiring within N days
const CURRENCY_DEFAULT = "PHP";

/** HELPERS **/
const currencyFormatter = (code) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: code });
const fmt = (n, code = CURRENCY_DEFAULT) => currencyFormatter(code).format(n);
const nowStr = () =>
  new Date().toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
const today = () => new Date();
const daysUntil = (iso) => {
  if (!iso) return Infinity;
  const d = new Date(iso);
  return Math.ceil((d - today()) / (1000 * 60 * 60 * 24));
};
const isExpired = (iso) => daysUntil(iso) < 0;
const isExpiringSoon = (iso) => !isExpired(iso) && daysUntil(iso) <= EXPIRY_SOON_DAYS;

/** SAMPLE INVENTORY (with expiry dates) **/
const sampleProducts = [
  { id: "BVG-001", name: "Bottled Water 500ml", price: 20, category: "Beverages", stock: 120, sku: "480000000001", expiry: "2026-12-31" },
  { id: "BVG-002", name: "Iced Tea 330ml", price: 35, category: "Beverages", stock: 80,  sku: "480000000002", expiry: "2026-12-31" },
  { id: "SNK-001", name: "Potato Chips 60g",   price: 55, category: "Snacks",    stock: 60,  sku: "480000000101", expiry: "2025-12-31" },
  { id: "SNK-002", name: "Chocolate Bar",      price: 45, category: "Snacks",    stock: 65,  sku: "480000000102", expiry: "2025-11-30" },
  { id: "PRC-001", name: "Toothpaste 100g",    price: 89, category: "Personal Care", stock: 50, sku: "480000000201", expiry: "2026-06-30" },
  { id: "GRC-001", name: "Rice 1kg",           price: 68, category: "Grocery",   stock: 200, sku: "480000000301", expiry: "2026-03-31" },
  { id: "GRC-002", name: "Eggs (dozen)",       price: 120,category: "Grocery",   stock: 30,  sku: "480000000302", expiry: "2025-10-20" },
  { id: "GRC-003", name: "Cooking Oil 1L",     price: 175,category: "Grocery",   stock: 40,  sku: "480000000303", expiry: "2026-09-30" },
];

/** STORAGE KEYS **/
const SETTINGS_KEY = "pos_settings";
const INVENTORY_KEY = "pos_inventory";

/** MAIN **/
export default function POSApp() {
  /** Settings **/
  const [taxRate, setTaxRate] = useState(12);
  const [discountPct, setDiscountPct] = useState(0);
  const [currency, setCurrency] = useState(CURRENCY_DEFAULT);

  /** Inventory (persisted) **/
  const [products, setProducts] = useState(sampleProducts);
  useEffect(() => {
    // load settings
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (saved.taxRate != null) setTaxRate(saved.taxRate);
      if (saved.discountPct != null) setDiscountPct(saved.discountPct);
      if (saved.currency) setCurrency(saved.currency);
    } catch {}
    // load inventory
    try {
      const inv = JSON.parse(localStorage.getItem(INVENTORY_KEY) || "null");
      if (Array.isArray(inv) && inv.length) setProducts(inv);
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ taxRate, discountPct, currency }));
  }, [taxRate, discountPct, currency]);
  const saveInventory = (list) => {
    setProducts(list);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(list));
  };

  /** Product filters **/
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
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

  /** Cart **/
  const [cart, setCart] = useState([]); // [{id, name, price, qty}]
  const addToCart = (prod) => {
    if (isExpired(prod.expiry)) {
      alert(`Item "${prod.name}" is EXPIRED and cannot be sold.`);
      return;
    }
    const inCartQty = cart.find((x) => x.id === prod.id)?.qty || 0;
    if (inCartQty + 1 > prod.stock) {
      alert(`Insufficient stock for ${prod.name}. In stock: ${prod.stock}`);
      return;
    }
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
    qty = Math.max(1, qty);
    const prod = products.find((p) => p.id === id);
    if (prod && qty > prod.stock) {
      alert(`Insufficient stock for ${prod.name}. In stock: ${prod.stock}`);
      return;
    }
    setCart((c) => c.map((x) => (x.id === id ? { ...x, qty } : x)));
  };
  const removeFromCart = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const clearCart = () => setCart([]);

  /** Totals **/
  const { subtotal, discountAmt, taxAmt, grandTotal } = useMemo(() => {
    const sub = cart.reduce((acc, x) => acc + x.price * x.qty, 0);
    const d = (sub * (Number(discountPct) || 0)) / 100;
    const txbl = Math.max(0, sub - d);
    const t = (txbl * (Number(taxRate) || 0)) / 100;
    return { subtotal: sub, discountAmt: d, taxAmt: t, grandTotal: txbl + t };
  }, [cart, taxRate, discountPct]);

  /** Payment **/
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashGiven, setCashGiven] = useState(0);
  const change = useMemo(() => {
    if (paymentMethod !== "Cash") return 0;
    const cg = Number(cashGiven) - (grandTotal || 0);
    return Math.max(0, Math.round(cg * 100) / 100);
  }, [cashGiven, grandTotal, paymentMethod]);

  /** Quick add (scanner) **/
  const scannerRef = useRef(null);
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

  /** Checkout & Receipt **/
  const [showCheckout, setShowCheckout] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const receiptRef = useRef(null);
  const canCheckout =
    cart.length > 0 &&
    cart.every((item) => {
      const prod = products.find((p) => p.id === item.id);
      return prod && item.qty <= prod.stock && !isExpired(prod.expiry);
    }) &&
    (paymentMethod !== "Cash" || Number(cashGiven) >= grandTotal);

  const completeSale = () => {
    // Deduct stock
    const next = products.map((p) => {
      const item = cart.find((c) => c.id === p.id);
      if (!item) return p;
      return { ...p, stock: p.stock - item.qty };
    });
    saveInventory(next);

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
        .center{text-align:center}.right{text-align:right}.muted{color:#555}
        table{width:100%;border-collapse:collapse}td{padding:2px 0}
        hr{border:0;border-top:1px dashed #999;margin:8px 0}
      </style></head><body>${receiptRef.current.innerHTML}</body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  /** Warnings **/
  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD),
    [products]
  );
  const expiringSoon = useMemo(
    () => products.filter((p) => isExpiringSoon(p.expiry)),
    [products]
  );
  const expired = useMemo(
    () => products.filter((p) => isExpired(p.expiry)),
    [products]
  );

  /** View switch: POS / Inventory **/
  const [view, setView] = useState("pos");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600" />
            <div>
              <h1 className="text-xl font-semibold">Simple POS</h1>
              <p className="text-xs text-slate-500">
                {currency} · VAT {taxRate}% · Low stock ≤ {LOW_STOCK_THRESHOLD} · Expiring ≤ {EXPIRY_SOON_DAYS}d
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setView("pos")}
              className={`px-3 py-1 rounded-xl border ${view === "pos" ? "bg-slate-100" : ""}`}
            >
              POS
            </button>
            <button
              onClick={() => setView("inventory")}
              className={`px-3 py-1 rounded-xl border ${view === "inventory" ? "bg-slate-100" : ""}`}
            >
              Inventory
            </button>

            <div className="hidden md:flex items-center gap-2 ml-4">
              <label className="text-slate-500">VAT%</label>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-16 border rounded-lg px-2 py-1" min={0} max={30} />
              <label className="text-slate-500">Discount%</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="w-16 border rounded-lg px-2 py-1" min={0} max={100} />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border rounded-lg px-2 py-1">
                <option value="PHP">PHP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="JPY">JPY</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings bar */}
      <div className="max-w-7xl mx-auto px-4 mt-4 grid gap-2">
        {expired.length > 0 && (
          <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {expired.length} item(s) expired: {expired.map((p) => p.name).join(", ")}
          </div>
        )}
        {expiringSoon.length > 0 && (
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            ⏳ {expiringSoon.length} item(s) expiring soon:{" "}
            {expiringSoon.map((p) => `${p.name} (${daysUntil(p.expiry)}d)`).join(", ")}
          </div>
        )}
        {lowStock.length > 0 && (
          <div className="p-2 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
            🟡 Low stock: {lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
          </div>
        )}
      </div>

      {view === "pos" ? (
        /* ====================== POS VIEW ====================== */
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Catalog */}
          <div className="lg:col-span-2">
            <div className="mb-3 grid sm:grid-cols-3 gap-2">
              <form onSubmit={(e) => e.preventDefault()} className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Search by name, ID, or SKU…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full border rounded-2xl px-4 py-2"
                />
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
              {filtered.map((p) => {
                const badge =
                  p.stock <= LOW_STOCK_THRESHOLD ? "Low stock" :
                  isExpired(p.expiry) ? "Expired" :
                  isExpiringSoon(p.expiry) ? `Expiring ${daysUntil(p.expiry)}d` : null;
                const badgeColor =
                  isExpired(p.expiry) ? "bg-red-100 text-red-700 border-red-200" :
                  p.stock <= LOW_STOCK_THRESHOLD ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                  isExpiringSoon(p.expiry) ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200";

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`text-left bg-white hover:shadow-md transition border border-slate-200 rounded-2xl p-3 ${isExpired(p.expiry) ? "opacity-60 cursor-not-allowed" : ""}`}
                    title={isExpired(p.expiry) ? "Expired – cannot sell" : "Add to cart"}
                    disabled={isExpired(p.expiry)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">{p.category}</span>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full border ${badge ? badgeColor : "hidden"}`}>{badge}</span>
                    </div>
                    <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl mb-2" />
                    <div className="text-sm font-medium leading-tight line-clamp-2">{p.name}</div>
                    <div className="text-xs text-slate-500">Stock: {p.stock}</div>
                    <div className="text-xs text-slate-500">Expiry: {p.expiry || "—"}</div>
                    <div className="mt-2 font-semibold">{fmt(p.price, currency)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">ID: {p.id} · SKU: {p.sku}</div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-slate-500 py-8">No products found.</div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Cart ({cart.reduce((a, x) => a + x.qty, 0)} items)</h2>
                <button onClick={clearCart} className="text-xs text-slate-500 hover:text-slate-700">Clear</button>
              </div>

              <div className="space-y-3 max-h-[52vh] overflow-auto pr-1">
                {cart.map((item) => {
                  const prod = products.find((p) => p.id === item.id);
                  const max = prod?.stock ?? item.qty;
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{item.name}</div>
                        <div className="text-xs text-slate-500">{fmt(item.price, currency)} each</div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex items-center border rounded-xl overflow-hidden">
                            <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2 py-1 text-sm">−</button>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => updateQty(item.id, Number(e.target.value))}
                              className="w-12 text-center text-sm py-1"
                              min={1}
                              max={max}
                            />
                            <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2 py-1 text-sm">+</button>
                          </div>
                          <div className="ml-auto font-semibold">{fmt(item.price * item.qty, currency)}</div>
                        </div>
                        {prod && prod.stock <= LOW_STOCK_THRESHOLD && (
                          <div className="text-[11px] text-amber-600 mt-1">Low stock (left: {prod.stock})</div>
                        )}
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500">✕</button>
                    </div>
                  );
                })}

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
                    <option>Cash</option><option>Card</option><option>E-Wallet</option>
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
      ) : (
        /* ==================== INVENTORY VIEW =================== */
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Inventory Monitor</h2>
              <button
                onClick={() => saveInventory([...products])}
                className="px-3 py-2 rounded-xl border"
                title="Inventory is auto-saved on change; this just forces a save."
              >
                Save
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-2">ID / SKU</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Category</th>
                    <th className="py-2 pr-2">Price</th>
                    <th className="py-2 pr-2">Stock</th>
                    <th className="py-2 pr-2">Expiry</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => {
                    const status = isExpired(p.expiry)
                      ? "Expired"
                      : isExpiringSoon(p.expiry)
                      ? `Expiring (${daysUntil(p.expiry)}d)`
                      : p.stock <= LOW_STOCK_THRESHOLD
                      ? "Low stock"
                      : "OK";
                    const statusClass =
                      status === "Expired"
                        ? "text-red-600"
                        : status.startsWith("Expiring")
                        ? "text-amber-700"
                        : status === "Low stock"
                        ? "text-yellow-700"
                        : "text-slate-500";

                    return (
                      <tr key={p.id} className="border-t">
                        <td className="py-2 pr-2">{p.id}<div className="text-[11px] text-slate-400">SKU: {p.sku}</div></td>
                        <td className="py-2 pr-2">{p.name}</td>
                        <td className="py-2 pr-2">{p.category}</td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            value={p.price}
                            min={0}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const next = [...products]; next[idx] = { ...p, price: v };
                              saveInventory(next);
                            }}
                            className="w-24 border rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            value={p.stock}
                            min={0}
                            onChange={(e) => {
                              const v = Math.max(0, Number(e.target.value));
                              const next = [...products]; next[idx] = { ...p, stock: v };
                              saveInventory(next);
                            }}
                            className="w-24 border rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="date"
                            value={p.expiry || ""}
                            onChange={(e) => {
                              const next = [...products]; next[idx] = { ...p, expiry: e.target.value || null };
                              saveInventory(next);
                            }}
                            className="border rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className={`py-2 ${statusClass}`}>{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-2">Inventory is saved to your browser (localStorage).</p>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
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

      {/* Printable receipt */}
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
            <table><tbody>
              {lastReceipt.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.qty} × {it.name}</td>
                  <td className="right">{fmt(it.price * it.qty, lastReceipt.currency)}</td>
                </tr>
              ))}
            </tbody></table>
            <hr />
            <table><tbody>
              <tr><td>Subtotal</td><td className="right">{fmt(lastReceipt.subtotal, lastReceipt.currency)}</td></tr>
              <tr><td>Discount ({lastReceipt.discountPct}%)</td><td className="right">− {fmt(lastReceipt.discountAmt, lastReceipt.currency)}</td></tr>
              <tr><td>VAT ({lastReceipt.taxRate}%)</td><td className="right">{fmt(lastReceipt.taxAmt, lastReceipt.currency)}</td></tr>
              <tr><td style={{ fontWeight: 700 }}>TOTAL</td><td className="right" style={{ fontWeight: 700 }}>{fmt(lastReceipt.total, lastReceipt.currency)}</td></tr>
            </tbody></table>
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
      <div>{label}</div><div>{value}</div>
    </div>
  );
}
