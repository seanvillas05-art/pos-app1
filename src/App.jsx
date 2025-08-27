import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========= Settings ========= */
const VAT_DEFAULT = 12;              // %
const DISCOUNT_DEFAULT = 0;          // %
const LOW_STOCK = 5;                 // warning if stock <= this
const EXPIRY_SOON_DAYS = 30;         // days

/* ========= Demo Users ========= */
const USERS = [
  { username: "admin",   password: "admin123", role: "admin",   fullName: "Administrator" },
  { username: "cashier", password: "cash123",  role: "cashier", fullName: "Cashier" },
];

/* ========= Storage Keys ========= */
const AUTH_KEY = "pos_auth";
const INV_KEY  = "pos_inventory";
const SET_KEY  = "pos_settings";

/* ========= Helpers ========= */
const fmt = (n, cur = "PHP") =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: cur }).format(n ?? 0);

const daysUntil = (iso) => {
  if (!iso) return Infinity;
  const d = new Date(iso);
  const ms = d - new Date();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};
const isExpired = (iso) => daysUntil(iso) < 0;
const expSoon = (iso) => !isExpired(iso) && daysUntil(iso) <= EXPIRY_SOON_DAYS;

/* ========= Starter Inventory (only used the first time) ========= */
const STARTER = [
  { id: "BVG-001", sku: "480000000001", name: "Bottled Water 500ml", category: "Beverages", price: 20,  stock: 120, expiry: "2026-12-31" },
  { id: "BVG-002", sku: "480000000002", name: "Iced Tea 330ml",      category: "Beverages", price: 35,  stock: 80,  expiry: "2026-12-31" },
  { id: "SNK-001", sku: "480000000101", name: "Potato Chips 60g",    category: "Snacks",    price: 55,  stock: 60,  expiry: "2025-12-31" },
  { id: "SNK-002", sku: "480000000102", name: "Chocolate Bar",       category: "Snacks",    price: 45,  stock: 65,  expiry: "2025-11-30" },
  { id: "PRC-001", sku: "480000000201", name: "Toothpaste 100g",     category: "Personal Care", price: 89, stock: 50, expiry: "2026-06-30" },
  { id: "GRC-001", sku: "480000000301", name: "Rice 1kg",            category: "Grocery",   price: 68,  stock: 200, expiry: "2026-03-31" },
  { id: "GRC-002", sku: "480000000302", name: "Eggs (dozen)",        category: "Grocery",   price: 120, stock: 30,  expiry: "2025-10-20" },
  { id: "GRC-003", sku: "480000000303", name: "Cooking Oil 1L",      category: "Grocery",   price: 175, stock: 40,  expiry: "2026-09-30" },
];

/* =============================================================== */

export default function App() {
  /* ----- Auth ----- */
  const [user, setUser] = useState(null);
  useEffect(() => {
    const s = localStorage.getItem(AUTH_KEY);
    if (s) setUser(JSON.parse(s));
  }, []);

  const onLogin = (u, p) => {
    const found = USERS.find(x => x.username === u && x.password === p);
    if (!found) return { ok: false, msg: "Invalid username or password" };
    const payload = { username: found.username, role: found.role, fullName: found.fullName };
    setUser(payload);
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
    return { ok: true };
  };
  const onLogout = () => { setUser(null); localStorage.removeItem(AUTH_KEY); };

  /* ----- Settings ----- */
  const [settings, setSettings] = useState({ vat: VAT_DEFAULT, discount: DISCOUNT_DEFAULT, currency: "PHP" });
  useEffect(() => {
    const s = localStorage.getItem(SET_KEY);
    if (s) setSettings(JSON.parse(s));
  }, []);
  useEffect(() => {
    localStorage.setItem(SET_KEY, JSON.stringify(settings));
  }, [settings]);

  /* ----- Inventory (persisted) ----- */
  const [inv, setInv] = useState(STARTER);
  useEffect(() => {
    const s = localStorage.getItem(INV_KEY);
    if (s) setInv(JSON.parse(s));
  }, []);
  const saveInv = (next) => {
    setInv(next);
    localStorage.setItem(INV_KEY, JSON.stringify(next));
  };

  /* ----- Search / filter ----- */
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const categories = useMemo(() => ["All", ...new Set(inv.map(p => p.category))], [inv]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return inv.filter(p => {
      const okCat = cat === "All" || p.category === cat;
      const okText =
        !t ||
        p.name.toLowerCase().includes(t) ||
        p.id.toLowerCase().includes(t) ||
        (p.sku && p.sku.toLowerCase().includes(t));
      return okCat && okText;
    });
  }, [q, cat, inv]);

  /* ----- Cart ----- */
  const [cart, setCart] = useState([]); // {id,name,price,qty}
  const addToCart = (p) => {
    if (isExpired(p.expiry)) return alert(`"${p.name}" is expired.`);
    const inCart = cart.find(x => x.id === p.id)?.qty || 0;
    if (inCart + 1 > p.stock) return alert(`Insufficient stock (${p.stock}) for ${p.name}`);
    setCart(c => {
      const i = c.findIndex(x => x.id === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };
  const updQty = (id, qty) => {
    const prod = inv.find(p => p.id === id);
    qty = Math.max(1, Number(qty) || 1);
    if (prod && qty > prod.stock) return alert(`Insufficient stock (${prod.stock}) for ${prod.name}`);
    setCart(c => c.map(x => x.id === id ? { ...x, qty } : x));
  };
  const rmCart = (id) => setCart(c => c.filter(x => x.id !== id));
  const clearCart = () => setCart([]);

  /* ----- Totals ----- */
  const { sub, discAmt, taxAmt, total } = useMemo(() => {
    const sub0 = cart.reduce((a, x) => a + x.price * x.qty, 0);
    const d = (sub0 * (Number(settings.discount) || 0)) / 100;
    const tx = ((sub0 - d) * (Number(settings.vat) || 0)) / 100;
    return { sub: sub0, discAmt: d, taxAmt: tx, total: sub0 - d + tx };
  }, [cart, settings]);

  /* ----- Payment / checkout ----- */
  const [method, setMethod] = useState("Cash");
  const [cash, setCash] = useState(0);
  const change = useMemo(() => (method !== "Cash" ? 0 : Math.max(0, Number(cash || 0) - total)), [cash, total, method]);

  const canCheckout =
    cart.length > 0 &&
    cart.every(it => {
      const p = inv.find(x => x.id === it.id);
      return p && it.qty <= p.stock && !isExpired(p.expiry);
    }) &&
    (method !== "Cash" || Number(cash) >= total);

  const [showConfirm, setShowConfirm] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const receiptRef = useRef(null);

  const completeSale = () => {
    // deduct inventory
    const next = inv.map(p => {
      const it = cart.find(c => c.id === p.id);
      return it ? { ...p, stock: Math.max(0, p.stock - it.qty) } : p;
    });
    saveInv(next);

    const rct = {
      id: `OR-${Date.now()}`,
      time: new Date().toLocaleString("en-PH"),
      items: cart.map(x => ({ ...x })),
      sub, discPct: settings.discount, discAmt, vatPct: settings.vat, taxAmt,
      total, method, cash: method === "Cash" ? Number(cash) : null, change: method === "Cash" ? change : null,
      currency: settings.currency, cashier: user?.fullName || "—",
    };
    setReceipt(rct);
    setShowConfirm(false);
    clearCart();
    setCash(0);
    setTimeout(() => printReceipt(), 50);
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;
    const w = window.open("", "_blank", "width=420,height=640");
    const html = `
      <!doctype html><html><head><meta charset="utf-8" />
      <title>Receipt</title>
      <style>
        *{font-family:ui-monospace,Menlo,Consolas,monospace}
        .c{text-align:center}.r{text-align:right}.muted{color:#666}
        table{width:100%;border-collapse:collapse} td{padding:2px 0}
        hr{border:0;border-top:1px dashed #aaa;margin:8px 0}
      </style></head><body>${receiptRef.current.innerHTML}</body></html>`;
    w.document.write(html); w.document.close(); w.focus(); w.print();
  };

  /* ----- Warnings ----- */
  const low = useMemo(() => inv.filter(p => p.stock <= LOW_STOCK), [inv]);
  const expSoonList = useMemo(() => inv.filter(p => expSoon(p.expiry)), [inv]);
  const expiredList = useMemo(() => inv.filter(p => isExpired(p.expiry)), [inv]);

  /* ----- View ----- */
  const [view, setView] = useState("pos"); // "pos" | "inventory"
  if (!user) return <Login onLogin={onLogin} />;

  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/90 border-b border-gray-200 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">MNL Coffee Supplies</div>
            <div className="text-xs text-gray-500">
              {settings.currency} • VAT {settings.vat}% • Low ≤ {LOW_STOCK} • Expiry ≤ {EXPIRY_SOON_DAYS}d
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setView("pos")}
              className={`px-3 py-1 rounded-lg border ${view === "pos" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-300"}`}
            >
              POS
            </button>
            <button
              onClick={() => isAdmin && setView("inventory")}
              disabled={!isAdmin}
              className={`px-3 py-1 rounded-lg border ${view === "inventory" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-300"} ${!isAdmin ? "opacity-50" : ""}`}
            >
              Inventory
            </button>

            {/* Settings quick edits (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <label className="text-gray-500">VAT%</label>
              <input type="number" min={0} max={30} value={settings.vat}
                onChange={e => setSettings(s => ({ ...s, vat: Number(e.target.value) }))}
                className="w-16 px-2 py-1 border rounded-lg" />
              <label className="text-gray-500">Disc%</label>
              <input type="number" min={0} max={100} value={settings.discount}
                onChange={e => setSettings(s => ({ ...s, discount: Number(e.target.value) }))}
                className="w-16 px-2 py-1 border rounded-lg" />
              <select value={settings.currency}
                onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
                className="px-2 py-1 border rounded-lg">
                <option>PHP</option><option>USD</option><option>EUR</option><option>JPY</option>
              </select>
            </div>

            <div className="px-2 py-1 rounded-lg bg-gray-100">{user.fullName} • {user.role}</div>
            <button onClick={onLogout} className="px-3 py-1 rounded-lg border hover:bg-gray-50">Logout</button>
          </div>
        </div>
      </div>

      {/* status banners */}
      <div className="max-w-7xl mx-auto px-4 pt-3 space-y-2 text-sm">
        {expiredList.length > 0 && (
          <div className="p-2 rounded-lg bg-red-50 text-red-700 border border-red-200">
            ⚠️ Expired: {expiredList.map(p => p.name).join(", ")}
          </div>
        )}
        {expSoonList.length > 0 && (
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            ⏳ Expiring soon: {expSoonList.map(p => `${p.name} (${daysUntil(p.expiry)}d)`).join(", ")}
          </div>
        )}
        {low.length > 0 && (
          <div className="p-2 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200">
            🟡 Low stock: {low.map(p => `${p.name} (${p.stock})`).join(", ")}
          </div>
        )}
      </div>

      {view === "pos" ? (
        <POS
          inv={inv}
          categories={categories}
          filtered={filtered}
          q={q} setQ={setQ}
          cat={cat} setCat={setCat}
          addToCart={addToCart}
          cart={cart}
          updQty={updQty}
          rmCart={rmCart}
          clearCart={clearCart}
          settings={settings}
          sub={sub} discAmt={discAmt} taxAmt={taxAmt} total={total}
          method={method} setMethod={setMethod}
          cash={cash} setCash={setCash}
          change={change}
          setShowConfirm={setShowConfirm}
          canCheckout={canCheckout}
        />
      ) : (
        <Inventory inv={inv} saveInv={saveInv} />
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">Confirm payment</div>
              <button onClick={() => setShowConfirm(false)} className="text-gray-500">✕</button>
            </div>
            <div className="text-sm space-y-1">
              <Row label="Total" value={fmt(total, settings.currency)} bold />
              <Row label="Method" value={method} />
              {method === "Cash" && (
                <>
                  <Row label="Cash Given" value={fmt(Number(cash) || 0, settings.currency)} />
                  <Row label="Change" value={fmt(change, settings.currency)} />
                </>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={completeSale} disabled={!canCheckout}
                className={`flex-1 px-4 py-2 rounded-lg text-white ${canCheckout ? "bg-gray-900" : "bg-gray-400 cursor-not-allowed"}`}>
                Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN receipt for printing */}
      {receipt && (
        <div className="p-4">
          <div className="max-w-sm mx-auto" ref={receiptRef}>
            <div className="c">
              <div style={{ fontWeight: 700 }}>MNL COFFEE SUPPLIES</div>
              <div className="muted">123 Demo St., Metro Manila</div>
            </div>
            <hr/>
            <div className="muted">OR: {receipt.id}</div>
            <div className="muted">Date: {receipt.time}</div>
            <div className="muted">Cashier: {receipt.cashier}</div>
            <hr/>
            <table><tbody>
              {receipt.items.map(it => (
                <tr key={it.id}><td>{it.qty} × {it.name}</td><td className="r">{fmt(it.price * it.qty, receipt.currency)}</td></tr>
              ))}
            </tbody></table>
            <hr/>
            <table><tbody>
              <tr><td>Subtotal</td><td className="r">{fmt(receipt.sub, receipt.currency)}</td></tr>
              <tr><td>Discount ({receipt.discPct}%)</td><td className="r">− {fmt(receipt.discAmt, receipt.currency)}</td></tr>
              <tr><td>VAT ({receipt.vatPct}%)</td><td className="r">{fmt(receipt.taxAmt, receipt.currency)}</td></tr>
              <tr><td style={{fontWeight:700}}>TOTAL</td><td className="r" style={{fontWeight:700}}>{fmt(receipt.total, receipt.currency)}</td></tr>
            </tbody></table>
            <hr/>
            <div>Payment: {receipt.method}</div>
            {receipt.method === "Cash" && (
              <>
                <div>Cash: {fmt(receipt.cash || 0, receipt.currency)}</div>
                <div>Change: {fmt(receipt.change || 0, receipt.currency)}</div>
              </>
            )}
            <hr/>
            <div className="c muted">Thank you!</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Small UI bits ============ */
const Row = ({ label, value, bold }) => (
  <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
    <div>{label}</div><div>{value}</div>
  </div>
);

/* ============ POS View ============ */
function POS({
  inv, categories, filtered, q, setQ, cat, setCat, addToCart,
  cart, updQty, rmCart, clearCart,
  settings, sub, discAmt, taxAmt, total,
  method, setMethod, cash, setCash, change,
  setShowConfirm, canCheckout
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Catalog */}
      <div className="lg:col-span-2">
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search name / ID / SKU…"
            className="sm:col-span-2 w-full px-4 py-2 border rounded-xl"
          />
          <select value={cat} onChange={e => setCat(e.target.value)} className="px-4 py-2 border rounded-xl">
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => {
            const flag = isExpired(p.expiry) ? "Expired"
              : p.stock <=  LOW_STOCK ? "Low" : expSoon(p.expiry) ? `Exp ${daysUntil(p.expiry)}d` : null;
            const disabled = isExpired(p.expiry);
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={disabled}
                className={`text-left bg-white border rounded-2xl p-3 hover:shadow ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <div>{p.category}</div>
                  {flag && <span className="px-2 py-[2px] border rounded-full">{flag}</span>}
                </div>
                <div className="h-20 rounded-xl bg-gray-100 mb-2" />
                <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                <div className="text-xs text-gray-500">Stock {p.stock} • Exp {p.expiry || "—"}</div>
                <div className="mt-2 font-semibold">{fmt(p.price, settings.currency)}</div>
                <div className="text-[10px] text-gray-400 mt-1">ID: {p.id} • SKU: {p.sku}</div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-8">No products found.</div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="lg:col-span-1">
        <div className="bg-white border rounded-2xl p-4 sticky top-24">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Cart ({cart.reduce((a,x)=>a+x.qty,0)})</div>
            <button onClick={clearCart} className="text-xs text-gray-500 hover:text-gray-800">Clear</button>
          </div>

          <div className="space-y-3 max-h-[52vh] overflow-auto pr-1">
            {cart.map(it => (
              <div key={it.id} className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">{fmt(it.price, settings.currency)} each</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button onClick={() => updQty(it.id, it.qty - 1)} className="px-2 py-1 text-sm">−</button>
                      <input type="number" min={1} value={it.qty}
                        onChange={e => updQty(it.id, e.target.value)}
                        className="w-12 text-center text-sm py-1" />
                      <button onClick={() => updQty(it.id, it.qty + 1)} className="px-2 py-1 text-sm">+</button>
                    </div>
                    <div className="ml-auto font-semibold">{fmt(it.price * it.qty, settings.currency)}</div>
                  </div>
                </div>
                <button onClick={() => rmCart(it.id)} className="text-gray-400 hover:text-red-500">✕</button>
              </div>
            ))}
            {cart.length === 0 && <div className="text-center text-gray-500 py-8">Your cart is empty.</div>}
          </div>

          <div className="my-4 border-t pt-3 space-y-1 text-sm">
            <Row label="Subtotal" value={fmt(sub, settings.currency)} />
            <Row label={`Discount (${settings.discount || 0}%)`} value={`− ${fmt(discAmt, settings.currency)}`} />
            <Row label={`VAT (${settings.vat || 0}%)`} value={fmt(taxAmt, settings.currency)} />
            <Row label="Total" value={fmt(total, settings.currency)} bold />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <label className="text-gray-600">Payment:</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="px-3 py-1 border rounded-lg">
                <option>Cash</option><option>Card</option><option>E-Wallet</option>
              </select>
            </div>
            {method === "Cash" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-gray-500 mb-1">Cash Given</div>
                  <input type="number" min={0} value={cash} onChange={e => setCash(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Change</div>
                  <div className="w-full px-3 py-2 border rounded-lg bg-gray-50">{fmt(change, settings.currency)}</div>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canCheckout}
              className={`w-full mt-2 px-4 py-3 rounded-xl text-white ${canCheckout ? "bg-gray-900" : "bg-gray-400 cursor-not-allowed"}`}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Inventory View (Admin) ============ */
function Inventory({ inv, saveInv }) {
  const [newItem, setNewItem] = useState({
    id: "", sku: "", name: "", category: "", price: 0, stock: 0, expiry: ""
  });

  const addItem = () => {
    if (!newItem.name.trim()) return alert("Name is required");
    const id = newItem.id.trim() || genId(newItem.category, inv);
    const sku = newItem.sku.trim() || Date.now().toString().slice(-12);
    const next = [
      ...inv,
      {
        id, sku,
        name: newItem.name.trim(),
        category: newItem.category.trim() || "General",
        price: Number(newItem.price) || 0,
        stock: Number(newItem.stock) || 0,
        expiry: newItem.expiry || null,
      },
    ];
    saveInv(next);
    setNewItem({ id: "", sku: "", name: "", category: "", price: 0, stock: 0, expiry: "" });
  };

  const remove = (id) => {
    if (!confirm("Remove this item?")) return;
    saveInv(inv.filter(p => p.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Inventory</div>
          <div className="text-sm text-gray-500">{inv.length} items</div>
        </div>

        {/* Add item form (mobile friendly) */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <input className="px-3 py-2 border rounded-xl" placeholder="Name *"
            value={newItem.name} onChange={e => setNewItem(s => ({ ...s, name: e.target.value }))} />
          <input className="px-3 py-2 border rounded-xl" placeholder="Category"
            value={newItem.category} onChange={e => setNewItem(s => ({ ...s, category: e.target.value }))} />
          <input type="number" className="px-3 py-2 border rounded-xl" placeholder="Price"
            value={newItem.price} onChange={e => setNewItem(s => ({ ...s, price: e.target.value }))} />
          <input type="number" className="px-3 py-2 border rounded-xl" placeholder="Stock"
            value={newItem.stock} onChange={e => setNewItem(s => ({ ...s, stock: e.target.value }))} />
          <input type="date" className="px-3 py-2 border rounded-xl"
            value={newItem.expiry || ""} onChange={e => setNewItem(s => ({ ...s, expiry: e.target.value }))} />
          <button onClick={addItem} className="px-3 py-2 rounded-xl bg-gray-900 text-white">+ Add Item</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Category</th>
                <th className="py-2 pr-2">Price</th>
                <th className="py-2 pr-2">Stock</th>
                <th className="py-2 pr-2">Expiry</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {inv.map((p, i) => {
                const status = isExpired(p.expiry)
                  ? "Expired"
                  : expSoon(p.expiry)
                  ? `Exp (${daysUntil(p.expiry)}d)`
                  : p.stock <= LOW_STOCK
                  ? "Low"
                  : "OK";
                const statusCls =
                  status === "Expired" ? "text-red-600" :
                  status.startsWith("Exp") ? "text-amber-700" :
                  status === "Low" ? "text-yellow-700" : "text-gray-500";
                return (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 pr-2">{p.name}</td>
                    <td className="py-2 pr-2">{p.category}</td>
                    <td className="py-2 pr-2">
                      <input type="number" value={p.price}
                        onChange={e => {
                          const next = [...inv]; next[i] = { ...p, price: Number(e.target.value) || 0 }; saveInv(next);
                        }}
                        className="w-24 px-2 py-1 border rounded-lg" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" value={p.stock}
                        onChange={e => {
                          const next = [...inv]; next[i] = { ...p, stock: Math.max(0, Number(e.target.value) || 0) }; saveInv(next);
                        }}
                        className="w-24 px-2 py-1 border rounded-lg" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="date" value={p.expiry || ""}
                        onChange={e => {
                          const next = [...inv]; next[i] = { ...p, expiry: e.target.value || null }; saveInv(next);
                        }}
                        className="px-2 py-1 border rounded-lg" />
                    </td>
                    <td className={`py-2 pr-2 ${statusCls}`}>{status}</td>
                    <td className="py-2 pr-2">
                      <button onClick={() => remove(p.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Inventory is saved locally in your browser.
        </div>
      </div>
    </div>
  );
}

/* ---------- tiny util ---------- */
function genId(category, inv) {
  const pref = (category || "GEN").slice(0, 3).toUpperCase();
  // get next 3-digit sequence not colliding
  let n = inv.length + 1;
  // basic guard against duplicates
  while (inv.some(p => p.id === `${pref}-${String(n).padStart(3, "0")}`)) n++;
  return `${pref}-${String(n).padStart(3, "0")}`;
}

/* ============ Login ============ */
function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const res = onLogin(u.trim(), p);
    if (!res.ok) setErr(res.msg);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow">
        <div className="text-xl font-semibold mb-4 text-center">MNL Coffee Supplies — Login</div>
        <input value={u} onChange={e => setU(e.target.value)} placeholder="Username"
          className="w-full mb-2 px-3 py-2 border rounded-lg" />
        <input value={p} onChange={e => setP(e.target.value)} type="password" placeholder="Password"
          className="w-full mb-2 px-3 py-2 border rounded-lg" />
        {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
        <button className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white">Sign in</button>
        <div className="text-[11px] text-gray-500 mt-3">
          Demo: admin/admin123 • cashier/cash123
        </div>
      </form>
    </div>
  );
}
