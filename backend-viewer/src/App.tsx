import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Database as DbIcon, Lock, RefreshCw, Table2, Network, Cloud, Droplets, Shirt, Gift, MessageSquareHeart, ExternalLink, Eye, AlertTriangle, Leaf } from "lucide-react";
import { ErDiagram, type SchemaRelation, type SchemaTable } from "./ErDiagram";
import { supabase, SUPABASE_URL, STORE_URL, friendlyError, formatNumber, timeAgo } from "./supabase";

interface ImpactStats { items_rehomed: number; items_donated: number; kg_saved: number; co2_saved_kg: number; water_saved_litres: number; items_available: number }
interface LogRow { id: number; table_name: string; action: string; record_id: string | null; summary: string; created_at: string }
type Status = "connecting" | "live" | "offline";

// What the public viewer can show for each table. Private tables are shown
// through privacy-safe views (masked email, no phone/address) or as counts only.
const SOURCES: Record<string, { source: string | null; note?: string; order?: string }> = {
  items: { source: "items", order: "created_at" },
  categories: { source: "categories", order: "sort_order" },
  ngos: { source: "ngos", order: "id" },
  item_images: { source: "item_images", order: "id" },
  reviews: { source: "reviews", order: "created_at" },
  feedback: { source: "feedback", order: "created_at" },
  activity_log: { source: "activity_log", order: "id" },
  profiles: { source: "v_public_profiles", note: "Shown via v_public_profiles — emails masked, phone hidden.", order: "created_at" },
  orders: { source: "v_public_orders", note: "Shown via v_public_orders — names, phones and addresses hidden.", order: "created_at" },
  order_items: { source: null, note: "Private: only the buyer and seller can see these rows." },
  cart_items: { source: null, note: "Private: each user sees only their own cart." },
  wishlists: { source: null, note: "Private: each user sees only their own wishlist." },
  donation_requests: { source: null, note: "Private: only the requester and donor can see these rows." },
};

const ACTION_STYLE: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800", UPDATE: "bg-amber-100 text-amber-800", DELETE: "bg-red-100 text-red-700", SYSTEM: "bg-gray-100 text-gray-700",
};

function cell(v: unknown) {
  if (v === null || v === undefined) return <span className="text-gray-300">null</span>;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return <span className="font-mono text-xs">{JSON.stringify(v).slice(0, 60)}</span>;
  const s = String(v);
  if (/^https?:\/\//.test(s)) return <a href={s} target="_blank" rel="noreferrer" className="text-blue-600 underline">link</a>;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return <span title={s}>{timeAgo(s)}</span>;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s)) return <span className="font-mono text-xs" title={s}>{s.slice(0, 8)}…</span>;
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

export default function App() {
  const [schema, setSchema] = useState<{ tables: SchemaTable[]; relations: SchemaRelation[] } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [changed, setChanged] = useState<Record<string, number>>({});
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [feed, setFeed] = useState<LogRow[]>([]);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("items");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowsErr, setRowsErr] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<{ page: string; avg: number; n: number }[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const loadCounts = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_table_counts");
    if (error) throw error;
    const next: Record<string, number> = {};
    (data as { table_name: string; row_count: number }[]).forEach((r) => { next[r.table_name] = Number(r.row_count); });
    setCounts((prev) => {
      const diff: Record<string, number> = {};
      Object.keys(next).forEach((k) => { if (prev[k] !== undefined && prev[k] !== next[k]) diff[k] = Date.now(); });
      if (Object.keys(diff).length) setChanged((c) => ({ ...c, ...diff }));
      return next;
    });
    setLastUpdate(new Date());
  }, []);

  const loadImpact = useCallback(async () => {
    const { data } = await supabase.from("v_impact_stats").select("*").single();
    if (data) setImpact(data as ImpactStats);
  }, []);

  const loadFeedback = useCallback(async () => {
    const { data } = await supabase.from("feedback").select("page, ease_rating");
    const by: Record<string, number[]> = {};
    (data ?? []).forEach((r: { page: string; ease_rating: number }) => { (by[r.page] ??= []).push(r.ease_rating); });
    setFeedbackSummary(Object.entries(by).map(([page, v]) => ({ page, n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => a.avg - b.avg));
  }, []);

  const loadRows = useCallback(async (table: string) => {
    const src = SOURCES[table];
    setRowsErr(null);
    if (!src?.source) { setRows(null); return; }
    let q = supabase.from(src.source).select("*").limit(25);
    if (src.order) q = q.order(src.order, { ascending: false });
    const { data, error } = await q;
    if (error) { setRowsErr(friendlyError(error)); setRows([]); return; }
    setRows(data as Record<string, unknown>[]);
  }, []);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const [{ data: s, error: se }, { data: log, error: le }] = await Promise.all([
          supabase.rpc("get_schema_info"),
          supabase.from("activity_log").select("*").order("id", { ascending: false }).limit(30),
        ]);
        if (se) throw se; if (le) throw le;
        const sch = s as { tables: SchemaTable[]; relations: SchemaRelation[] | null };
        setSchema({ tables: sch.tables ?? [], relations: sch.relations ?? [] });
        setFeed(log as LogRow[]);
        await Promise.all([loadCounts(), loadImpact(), loadFeedback()]);
      } catch (e) { setError(friendlyError(e)); setStatus("offline"); }
    })();
  }, [loadCounts, loadImpact, loadFeedback]);

  useEffect(() => { loadRows(selected); }, [selected, loadRows]);

  // realtime: every change in the app writes one line to activity_log
  useEffect(() => {
    const channel = supabase
      .channel("live-db")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
        const row = payload.new as LogRow;
        setFeed((f) => [row, ...f].slice(0, 50));
        setFreshIds((s) => new Set(s).add(row.id));
        setTimeout(() => setFreshIds((s) => { const n = new Set(s); n.delete(row.id); return n; }), 2500);
        loadCounts().catch(() => {});
        loadImpact();
        if (row.table_name === "feedback") loadFeedback();
        const shown = SOURCES[selectedRef.current]?.source;
        const touchesShown = row.table_name === selectedRef.current || (shown && shown.includes(row.table_name)) || selectedRef.current === "activity_log";
        if (touchesShown) loadRows(selectedRef.current);
      })
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "live" : s === "CLOSED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? "offline" : "connecting"));
    // safety net: refresh counters every 30 s even if realtime is blocked by a network
    const poll = setInterval(() => { loadCounts().catch(() => {}); }, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [loadCounts, loadImpact, loadFeedback, loadRows]);

  const tables = schema?.tables ?? [];
  const selectedTable = tables.find((t) => t.name === selected);
  const projectRef = useMemo(() => SUPABASE_URL.replace("https://", "").split(".")[0], []);
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="max-w-lg mx-auto my-10 border border-red-200 bg-red-50 rounded-xl p-6 text-center" role="alert">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" aria-hidden />
          <p className="text-red-800 font-medium">Couldn't load the database</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 border bg-white rounded-md px-3 py-1.5 text-sm"><RefreshCw className="h-4 w-4" />Try again</button>
        </div>
        <p className="text-center text-sm text-gray-500">If this is a fresh project, run <code className="bg-gray-100 px-1 rounded">database/schema.sql</code> in the Supabase SQL Editor first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><Leaf className="h-5 w-5 text-green-400" />EcoThreads <span className="text-slate-400 font-normal">/ Backend Viewer</span></div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">read-only · PostgreSQL · Supabase</span>
        </div>
      </header>
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800 flex items-center gap-3"><DbIcon className="h-8 w-8 text-green-600" />Live Database</h1>
            <p className="text-gray-600 mt-1">The real database behind the EcoThreads store. Every sign-up, listing, order and review on the website shows up here instantly.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border ${status === "live" ? "bg-green-50 border-green-200 text-green-800" : status === "connecting" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-gray-100 text-gray-600"}`} role="status">
              <span className={`h-2.5 w-2.5 rounded-full ${status === "live" ? "bg-green-500 animate-pulse" : status === "connecting" ? "bg-amber-500" : "bg-gray-400"}`} />
              {status === "live" ? "Live" : status === "connecting" ? "Connecting…" : "Auto-refresh every 30 s"}
            </span>
            {STORE_URL && <a href={STORE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 border bg-white rounded-md px-3 py-1.5 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" />Open store</a>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[["Database", "PostgreSQL (Supabase)"], ["Project", projectRef], ["Tables", `${tables.length} tables · ${schema?.relations.length ?? 0} relationships`], ["Total rows", `${formatNumber(totalRows)}${lastUpdate ? ` · updated ${lastUpdate.toLocaleTimeString("en-IN")}` : ""}`]].map(([k, v]) => (
            <div key={k} className="bg-white border rounded-lg p-3"><div className="text-gray-500 text-xs">{k}</div><div className="font-medium text-gray-800 truncate">{v}</div></div>
          ))}
        </div>

        {/* Impact */}
        <section aria-label="Impact" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shirt, label: "Items re-homed", v: impact ? formatNumber(impact.items_rehomed) : "–" },
            { icon: Gift, label: "Donations listed", v: impact ? formatNumber(impact.items_donated) : "–" },
            { icon: Cloud, label: "CO₂ saved (est.)", v: impact ? `${formatNumber(impact.co2_saved_kg)} kg` : "–" },
            { icon: Droplets, label: "Water saved (est.)", v: impact ? `${formatNumber(impact.water_saved_litres)} L` : "–" },
          ].map((s) => (
            <div key={s.label} className="bg-white border rounded-xl p-4 flex items-center gap-3">
              <s.icon className="h-7 w-7 text-green-600" aria-hidden />
              <div><div className="text-xl font-semibold">{s.v}</div><div className="text-xs text-gray-500">{s.label}</div></div>
            </div>
          ))}
        </section>

        <div className="grid xl:grid-cols-3 gap-6">
          {/* ER diagram */}
          <section className="xl:col-span-2 bg-white border rounded-xl" aria-labelledby="er-h">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="er-h" className="font-semibold flex items-center gap-2"><Network className="h-5 w-5 text-green-600" />ER diagram</h2>
              <p className="text-xs text-gray-500">🔑 primary key · 🔗 foreign key · * required · hover a table to trace its links</p>
            </div>
            <div className="overflow-auto max-h-[640px] p-2">
              {schema ? <ErDiagram tables={tables} relations={schema.relations} counts={counts} highlight={selected} />
                : <div className="h-96 flex items-center justify-center text-gray-400">Loading schema…</div>}
            </div>
          </section>

          {/* Activity feed */}
          <section className="bg-white border rounded-xl flex flex-col" aria-labelledby="feed-h">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="feed-h" className="font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-green-600" />Live activity</h2>
              <span className="text-xs text-gray-500">newest first</span>
            </div>
            <ol className="divide-y overflow-y-auto max-h-[640px]" aria-live="polite">
              {feed.length === 0 && <li className="p-6 text-sm text-gray-500 text-center">No activity yet. Try listing an item on the store.</li>}
              {feed.map((f) => (
                <li key={f.id} className={`p-3 text-sm ${freshIds.has(f.id) ? "row-flash feed-in" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${ACTION_STYLE[f.action] ?? ""}`}>{f.action}</span>
                    <span className="text-xs text-gray-400">{timeAgo(f.created_at)}</span>
                  </div>
                  <p className="text-gray-800 mt-1">{f.summary}</p>
                  <p className="text-xs text-gray-400 font-mono">{f.table_name}{f.record_id ? ` · ${f.record_id.slice(0, 8)}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Table explorer */}
        <section className="bg-white border rounded-xl" aria-labelledby="tables-h">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 id="tables-h" className="font-semibold flex items-center gap-2"><Table2 className="h-5 w-5 text-green-600" />Tables</h2>
            <button onClick={() => { loadRows(selected); loadCounts(); }} className="inline-flex items-center gap-1 text-sm rounded-md px-3 py-1.5 hover:bg-slate-100"><RefreshCw className="h-4 w-4" />Refresh</button>
          </div>
          <div className="flex flex-col lg:flex-row">
            <ul className="lg:w-60 border-b lg:border-b-0 lg:border-r p-2 flex lg:flex-col gap-1 overflow-x-auto" role="tablist" aria-label="Choose a table">
              {tables.map((t) => (
                <li key={t.name}>
                  <button role="tab" aria-selected={selected === t.name} onClick={() => setSelected(t.name)}
                    className={`w-full whitespace-nowrap flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm ${selected === t.name ? "bg-green-100 text-green-800 font-medium" : "hover:bg-gray-50"}`}>
                    <span className="flex items-center gap-1.5">{!SOURCES[t.name]?.source && <Lock className="h-3 w-3 text-gray-400" />}{t.name}</span>
                    <span key={changed[t.name]} className={`text-xs tabular-nums rounded px-1.5 ${changed[t.name] && Date.now() - changed[t.name] < 3000 ? "row-flash" : ""} text-gray-500`}>{counts[t.name] ?? "–"}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex-1 min-w-0 p-4 space-y-4">
              {selectedTable && (
                <>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedTable.name}</h3>
                    {selectedTable.comment && <p className="text-sm text-gray-600">{selectedTable.comment}</p>}
                  </div>
                  <details className="text-sm" open>
                    <summary className="cursor-pointer text-gray-700 font-medium">Columns ({selectedTable.columns.length})</summary>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTable.columns.map((c) => {
                        const rel = schema?.relations.find((r) => r.from_table === selectedTable.name && r.from_column === c.name);
                        return (
                          <span key={c.name} className={`border rounded-md px-2 py-1 text-xs ${c.is_pk ? "bg-amber-50 border-amber-200" : rel ? "bg-blue-50 border-blue-200" : "bg-gray-50"}`}>
                            <span className="font-medium">{c.name}</span> <span className="text-gray-500">{c.type}</span>
                            {c.is_pk && <span className="text-amber-700"> · PK</span>}
                            {rel && <button className="text-blue-700 underline ml-1" onClick={() => setSelected(rel.to_table)}>→ {rel.to_table}</button>}
                          </span>
                        );
                      })}
                    </div>
                  </details>

                  {SOURCES[selected]?.note && (
                    <p className="text-sm bg-blue-50 border border-blue-200 text-blue-900 rounded-md p-3 flex gap-2">
                      {SOURCES[selected]?.source ? <Eye className="h-4 w-4 mt-0.5 shrink-0" /> : <Lock className="h-4 w-4 mt-0.5 shrink-0" />}
                      <span>{SOURCES[selected]?.note} {!SOURCES[selected]?.source && `It currently holds ${counts[selected] ?? 0} rows.`}</span>
                    </p>
                  )}
                  {rowsErr && <p className="text-sm text-red-600">{rowsErr}</p>}

                  {rows && rows.length > 0 && (
                    <div className="overflow-auto border rounded-lg max-h-[460px]">
                      <table className="text-sm min-w-full">
                        <caption className="sr-only">Latest rows in {selected}</caption>
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>{Object.keys(rows[0]).map((k) => <th key={k} scope="col" className="text-left font-medium text-gray-600 px-3 py-2 whitespace-nowrap border-b">{k}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={String(r.id ?? r.order_number ?? i)} className="odd:bg-white even:bg-gray-50/60">
                              {Object.keys(rows[0]).map((k) => <td key={k} className="px-3 py-1.5 whitespace-nowrap border-b border-gray-100">{cell(r[k])}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {rows && rows.length === 0 && !rowsErr && <p className="text-sm text-gray-500">No rows yet.</p>}
                  {rows && rows.length > 0 && <p className="text-xs text-gray-500">Showing the latest {rows.length} of {counts[selected] ?? rows.length} rows.</p>}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Usability feedback summary */}
        <section className="bg-white border rounded-xl p-4" aria-labelledby="fb-h">
          <h2 id="fb-h" className="font-semibold flex items-center gap-2 mb-1"><MessageSquareHeart className="h-5 w-5 text-green-600" />Usability feedback by page</h2>
          <p className="text-sm text-gray-600 mb-4">Average “how easy was it?” score (1–5) from the in-app feedback button. Lowest first — these pages need attention.</p>
          {feedbackSummary.length === 0 ? <p className="text-sm text-gray-500">No feedback yet.</p> : (
            <ul className="space-y-2">
              {feedbackSummary.map((f) => (
                <li key={f.page} className="grid grid-cols-[140px_1fr_90px] items-center gap-3 text-sm">
                  <span className="truncate font-medium">{f.page}</span>
                  <span className="h-3 bg-gray-100 rounded-full overflow-hidden" aria-hidden>
                    <span className={`block h-full rounded-full ${f.avg >= 4 ? "bg-green-500" : f.avg >= 3 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${(f.avg / 5) * 100}%` }} />
                  </span>
                  <span className="text-gray-600 tabular-nums">{f.avg.toFixed(1)} / 5 <span className="text-gray-400">({f.n})</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
