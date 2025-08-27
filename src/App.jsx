import React, { useMemo, useRef, useState, useEffect } from "react";

/* ===================== CONFIG ===================== */
const LOW_STOCK_THRESHOLD = 5;
const EXPIRY_SOON_DAYS = 30;
const CURRENCY_DEFAULT = "PHP";

/* ===================== HELPERS ===================== */
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

/* ===================== SAMPLE DATA ===================== */
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

/* ===================== STORAGE KEYS ===================== */
const SETTINGS_KEY = "pos_settings";
const INVENTORY_KEY = "pos_inventory";
const THEME_KEY = "pos_theme";

/* ===================== UI ATOMS ===================== */
const Badge = ({ tone = "slate", children }) => (
  <span className={`px-2 py-0.5 text-[10px] rounded-full border 
    ${tone === "red" ? "bg-red-100/70 text-red-700 border-red-200" :
      tone === "amber" ? "bg-amber-100/70 text-amber-700 border-amber-200" :
      tone === "yellow" ? "bg-yellow-100/70 text-yellow-700 border-yellow-200" :
      tone === "indigo" ? "bg-indigo-100/70 text-indigo-700 border-indigo-200" :
      "bg-slate-100/70 text-slate-600 border-slate-200"}`}>
    {children}
  </span>
);

const Row = ({ label, value, bold }) => (
  <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
    <div>{label}</div><div>{value}</div>
  </div>
);

/* ===================== MAIN ===================== */
export default function POSApp() {
  /* Theme (light / dark) */
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  /* Settings */
  const [taxRate, setTaxRate] = useState(12);
  const [discountPct, setDiscountPct] = useState(0);
  const [currency, setCurrency] = useState(CURRENCY_DEFAULT);

  /* Inventory (persisted) */
  const [products, setProducts] = useState(sampleProducts);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.taxRate != null) setTaxRate(s.taxRate);
      if (s.discountPct != null) setDiscountPct(s.discountPct);
      if (s.currency) setCurrency(s.currency);
    } catch {}
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

  /* Filters */
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
      const inText = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
      return inCat && inText;
    });
  }, [query, category, products]);

  /* Cart */
  const [cart, setCart] = useState([]);
  const addToCart = (prod) => {
    if (isExpired(prod.expiry)) return alert(`"${prod.name}" is EXPIRED and cannot be sold.`);
    const inCart = cart.find((x) => x.id === prod.id)?.qty || 0;
    if (inCart + 1 > prod.stock) return alert(`Insufficient stock for ${prod.name}. In stock: ${prod.stock}`);
    setCart((c) => {
      const i = c.findIndex((x) => x.id === prod.id);
      if (i >= 0) { const next = [...c]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...c, { id: prod.id, name: prod.name, price: prod.price, qty: 1 }];
    });
  };
  const updateQty = (id, qty) => {
    qty = Math.max(1, qty);
    const prod = products.find((p) => p.id === id);
    if (prod && qty > prod.stock) return alert(`Insufficient stock for ${prod.name}. In stock: ${prod.stock}`);
    setCart((c) => c.map((x) => (x.id === id ? { ...x, qty } : x)));
  };
  const removeFromCart = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const clearCart = () => setCart([]);

  /* Totals */
  const { subtotal, discountAmt, taxAmt, grandTotal } = useMemo(() => {
    const sub = cart.reduce((acc, x) => acc + x.price * x.qty, 0);
    const d = (sub * (Number(discountPct) || 0)) / 100;
    const txbl = Math.max(0, sub - d);
    const t = (txbl * (Number(taxRate) || 0)) / 100;
    return { subtotal: sub, discountAmt: d, taxAmt: t, grandTotal: txbl + t };
  }, [cart, taxRate, discountPct]);

  /* Payment */
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashGiven, setCashGiven] = useState(0);
  const change = useMemo(() => {
    if (paymentMethod !== "Cash") return 0;
    const cg = Number(cashGiven) - (grandTotal || 0);
    return Math.max(0, Math.round(cg * 100) / 100);
  }, [cashGiven, grandTotal, paymentMethod]);

  /* Quick add */
  const scannerRef = useRef(null);
  const handleScan = (e) => {
    e.preventDefault();
    const val = scannerRef.current?.value?.trim();
    if (!val) return;
    const p = products.find((x) => x.sku === val || x.id.toLowerCase() === val.toLowerCase());
    if (p) addToCart(p);
    scannerRef.current.value = "";
  };

  /* Checkout + receipt */
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
    setTimeout(() => printReceipt(), 40);
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;
    const w = window.open("", "_blank", "width=480,height=640");
    const html = `<!doctype html><html><head><meta charset='utf-8' />
      <title>Receipt</title>
      <style>
        *{font-family: ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace}
        .center{text-align:center}.right{text-align:right}.muted{color:#555}
        table{width:100%;border-collapse:collapse}td{padding:2px 0}
        hr{border:0;border-top:1px dashed #999;margin:8px 0}
      </style></head><body>${receiptRef.current.innerHTML}</body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  /* Warnings (for banners) */
  const lowStock = useMemo(() => products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD), [products]);
  const expiringSoon = useMemo(() => products.filter((p) => isExpiringSoon(p.expiry)), [products]);
  const expired = useMemo(() => products.filter((p) => isExpired(p.expiry)), [products]);

  /* Views */
  const [view, setView] = useState("pos");

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100">
      {/* ======= APP BAR ======= */}
      <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/60 border-b border-white/50 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">NovaPOS</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currency} • VAT {taxRate}% • Low ≤ {LOW_STOCK_THRESHOLD} • Expiry ≤ {EXPIRY_SOON_DAYS}d
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <label className="text-slate-500 dark:text-slate-400">VAT%</label>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-16 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1" min={0} max={30}/>
              <label className="text-slate-500 dark:text-slate-400">Disc%</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))}
                className="w-16 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1" min={0} max={100}/>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
                <option value="PHP">PHP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="JPY">JPY</option>
              </select>
            </div>

            <div className="ml-2 flex gap-1 rounded-xl p-1 bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <button onClick={() => setView("pos")}
                className={`px-3 py-1 rounded-lg text-sm transition ${view === "pos" ? "bg-white dark:bg-slate-700 shadow" : "hover:bg-white/60 dark:hover:bg-slate-700/60"}`}>
                POS
              </button>
              <button onClick={() => setView("inventory")}
                className={`px-3 py-1 rounded-lg text-sm transition ${view === "inventory" ? "bg-white dark:bg-slate-700 shadow" : "hover:bg-white/60 dark:hover:bg-slate-700/60"}`}>
                Inventory
              </button>
            </div>

            <button onClick={toggleTheme}
              className="ml-2 px-3 py-1 rounded-xl text-sm bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition">
              {theme === "light" ? "Dark" : "Light"}
            </button>
          </div>
        </div>
      </div>

      {/* ======= STATUS BANNERS ======= */}
      <div className="max-w-7xl mx-auto px-4 mt-4 grid gap-2">
        {expired.length > 0 && (
          <div className="p-3 rounded-2xl bg-red-50/80 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm shadow-sm">
            ⚠️ {expired.length} item(s) expired: {expired.map((p) => p.name).join(", ")}
          </div>
        )}
        {expiringSoon.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200 text-sm shadow-sm">
            ⏳ {expiringSoon.length} item(s) expiring soon:{" "}
            {expiringSoon.map((p) => `${p.name} (${daysUntil(p.expiry)}d)`).join(", ")}
          </div>
        )}
        {lowStock.length > 0 && (
          <div className="p-3 rounded-2xl bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-200 text-sm shadow-sm">
            🟡 Low stock: {lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
          </div>
        )}
      </div>

      {/* ======= MAIN ======= */}
      {view === "pos" ? (
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
                  className="w-full rounded-2xl px-4 py-2 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
                />
              </form>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-2xl px-4 py-2 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="mb-3">
              <form onSubmit={handleScan} className="flex items-center gap-2">
                <input
                  ref={scannerRef}
                  type="text"
                  placeholder="Quick add via SKU/ID (press Enter)"
                  className="w-full rounded-2xl px-4 py-2 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
                />
                <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm hover:scale-[1.02] active:scale-[0.99] transition dark:bg-slate-100 dark:text-slate-900">
                  Add
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const badge =
                  isExpired(p.expiry) ? "Expired" :
                  p.stock <= LOW_STOCK_THRESHOLD ? "Low stock" :
                  isExpiringSoon(p.expiry) ? `Expiring ${daysUntil(p.expiry)}d` : null;
                const tone =
                  isExpired(p.expiry) ? "red" :
                  p.stock <= LOW_STOCK_THRESHOLD ? "yellow" :
                  isExpiringSoon(p.expiry) ? "amber" : "slate";

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={isExpired(p.expiry)}
                    className={`group text-left rounded-2xl p-3 border bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:bg-white dark:hover:bg-slate-800 transition 
                      ${isExpired(p.expiry) ? "opacity-60 cursor-not-allowed" : ""}`}
                    title={isExpired(p.expiry) ? "Expired – cannot sell" : "Add to cart"}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{p.category}</span>
                      {badge && <Badge tone={tone}>{badge}</Badge>}
                    </div>
                    <div className="h-24 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 mb-3 group-hover:scale-[1.01] transition" />
                    <div className="text-sm font-medium leading-tight line-clamp-2">{p.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Stock: {p.stock} • Exp: {p.expiry || "—"}</div>
                    <div className="mt-2 font-semibold">{fmt(p.price, currency)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">ID: {p.id} • SKU: {p.sku}</div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-8">No products found.</div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 sticky top-24 shadow-lg shadow-indigo-500/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Cart ({cart.reduce((a, x) => a + x.qty, 0)})</h2>
                <button onClick={clearCart} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">Clear</button>
              </div>

              <div className="space-y-3 max-h-[52vh] overflow-auto pr-1">
                {cart.map((item) => {
                  const prod = products.find((p) => p.id === item.id);
                  const max = prod?.stock ?? item.qty;
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-slate-700 dark:to-slate-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{item.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{fmt(item.price, currency)} each</div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2 py-1 text-sm">−</button>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => updateQty(item.id, Number(e.target.value))}
                              className="w-12 text-center text-sm py-1 bg-transparent"
                              min={1}
                              max={max}
                            />
                            <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2 py-1 text-sm">+</button>
                          </div>
                          <div className="ml-auto font-semibold">{fmt(item.price * item.qty, currency)}</div>
                        </div>
                        {prod && prod.stock <= LOW_STOCK_THRESHOLD && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-300 mt-1">Low stock (left: {prod.stock})</div>
                        )}
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500">✕</button>
                    </div>
                  );
                })}

                {cart.length === 0 && (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-8">Your cart is empty.</div>
                )}
              </div>

              <div className="my-4 border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1 text-sm">
                <Row label="Subtotal" value={fmt(subtotal, currency)} />
                <Row label={`Discount (${discountPct || 0}%)`} value={`− ${fmt(discountAmt, currency)}`} />
                <Row label={`Tax (${taxRate || 0}%)`} value={fmt(taxAmt, currency)} />
                <Row label="Total" value={fmt(grandTotal, currency)} bold />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-slate-600 dark:text-slate-300">Payment:</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="rounded-xl px-3 py-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <option>Cash</option><option>Card</option><option>E-Wallet</option>
                  </select>
                </div>
                {paymentMethod === "Cash" && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 mb-1">Cash Given</label>
                      <input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" min={0}/>
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 mb-1">Change</label>
                      <div className="w-full rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{fmt(change, currency)}</div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={!canCheckout}
                  className={`w-full mt-2 px-4 py-3 rounded-2xl text-white font-medium shadow-lg shadow-indigo-500/20 
                    transition hover:scale-[1.01] active:scale-[0.99]
                    ${canCheckout ? "bg-gradient-to-r from-indigo-600 to-violet-600" : "bg-slate-400 cursor-not-allowed"}`}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ======= INVENTORY VIEW ======= */
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shadow-lg shadow-indigo-500/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Inventory Monitor</h2>
                <Badge tone="indigo">{products.length} items</Badge>
              </div>
              <button
                onClick={() => saveInventory([...products])}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 transition"
              >
                Save
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 dark:text-slate-400">
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
                    const cls =
                      status === "Expired" ? "text-red-600 dark:text-red-300" :
                      status.startsWith("Expiring") ? "text-amber-700 dark:text-amber-300" :
                      status === "Low stock" ? "text-yellow-700 dark:text-yellow-300" :
                      "text-slate-500 dark:text-slate-400";
                    return (
                      <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-2 pr-2">{p.id}<div className="text-[11px] text-slate-400">SKU: {p.sku}</div></td>
                        <td className="py-2 pr-2">{p.name}</td>
                        <td className="py-2 pr-2">{p.category}</td>
                        <td className="py-2 pr-2">
                          <input type="number" value={p.price} min={0}
                            onChange={(e) => { const v = Number(e.target.value); const next = [...products]; next[idx] = { ...p, price: v }; saveInventory(next); }}
                            className="w-24 rounded-lg px-2 py-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"/>
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" value={p.stock} min={0}
                            onChange={(e) => { const v = Math.max(0, Number(e.target.value)); const next = [...products]; next[idx] = { ...p, stock: v }; saveInventory(next); }}
                            className="w-24 rounded-lg px-2 py-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"/>
                        </td>
                        <td className="py-2 pr-2">
                          <input type="date" value={p.expiry || ""}
                            onChange={(e) => { const next = [...products]; next[idx] = { ...p, expiry: e.target.value || null }; saveInventory(next); }}
                            className="rounded-lg px-2 py-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"/>
                        </td>
                        <td className={`py-2 ${cls}`}>{status}</td>
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

      {/* ======= CHECKOUT MODAL ======= */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl p-5 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Confirm Payment</h3>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
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
              <button onClick={() => setShowCheckout(false)} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">Cancel</button>
              <button onClick={completeSale} disabled={!canCheckout}
                className={`flex-1 px-4 py-2 rounded-xl text-white shadow-lg shadow-indigo-500/20
                ${canCheckout ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-[1.01]" : "bg-slate-400"}`}>
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======= PRINTABLE RECEIPT (HIDDEN) ======= */}
      <div className="p-4">
        {lastReceipt && (
          <div className="max-w-sm mx-auto" ref={receiptRef}>
            <div className="center">
              <div style={{ fontSize: 16, fontWeight: 700 }}>NOVAPOS RECEIPT</div>
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
