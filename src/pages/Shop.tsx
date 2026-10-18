import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ItemCard } from "@/components/ItemCard";
import { Breadcrumbs, EmptyState, ErrorState, GridSkeleton } from "@/components/common";
import { supabase, friendlyError } from "@/lib/supabase";
import { CONDITIONS, formatINR } from "@/lib/format";
import type { Category, ItemFull } from "@/lib/types";

const PAGE = 12;
const SORTS = {
  newest: { label: "Newest first", col: "created_at", asc: false },
  price_asc: { label: "Price: low to high", col: "price", asc: true },
  price_desc: { label: "Price: high to low", col: "price", asc: false },
  popular: { label: "Most viewed", col: "views", asc: false },
} as const;
type SortKey = keyof typeof SORTS;

const PRICE_PRESETS = [
  { label: "Under ₹500", min: "", max: "500" },
  { label: "₹500 – ₹1,000", min: "500", max: "1000" },
  { label: "₹1,000 – ₹2,000", min: "1000", max: "2000" },
  { label: "Over ₹2,000", min: "2000", max: "" },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ItemFull[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const type = params.get("type") ?? "all";
  const conditions = (params.get("condition") ?? "").split(",").filter(Boolean);
  const min = params.get("min") ?? "";
  const max = params.get("max") ?? "";
  const sort = (params.get("sort") as SortKey) in SORTS ? (params.get("sort") as SortKey) : "newest";
  const showSold = params.get("sold") === "1";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || value === "all") next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order").then(({ data }) => setCategories((data as Category[]) ?? []));
  }, []);

  const buildQuery = (from: number) => {
    let query = supabase.from("v_items_full").select("*", { count: "exact" });
    if (!showSold) query = query.eq("status", "active");
    if (category) query = query.eq("category_slug", category);
    if (type === "sell" || type === "donate") query = query.eq("listing_type", type);
    if (conditions.length) query = query.in("condition", conditions);
    if (min) query = query.gte("price", Number(min));
    if (max) query = query.lte("price", Number(max));
    if (q) {
      const safe = q.replace(/[%,()]/g, " ");
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,brand.ilike.%${safe}%,color.ilike.%${safe}%`);
    }
    const s = SORTS[sort];
    return query.order(s.col, { ascending: s.asc }).order("id").range(from, from + PAGE - 1);
  };

  const key = params.toString();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    buildQuery(0).then(({ data, error, count }) => {
      if (cancelled) return;
      if (error) setError(friendlyError(error));
      else { setItems(data as ItemFull[]); setTotal(count ?? 0); }
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = async () => {
    setLoadingMore(true);
    const { data, error } = await buildQuery(items.length);
    setLoadingMore(false);
    if (error) { setError(friendlyError(error)); return; }
    setItems((prev) => [...prev, ...(data as ItemFull[])]);
  };

  const catName = categories.find((c) => c.slug === category)?.name;

  // Active filter chips (recognition rather than recall: users always see what's applied)
  const chips = useMemo(() => {
    const c: { label: string; clear: () => void }[] = [];
    if (q) c.push({ label: `“${q}”`, clear: () => setParam("q", null) });
    if (catName) c.push({ label: catName, clear: () => setParam("category", null) });
    if (type !== "all") c.push({ label: type === "donate" ? "Free / donated" : "For sale", clear: () => setParam("type", null) });
    conditions.forEach((cd) => c.push({ label: cd, clear: () => setParam("condition", conditions.filter((x) => x !== cd).join(",")) }));
    if (min || max) c.push({ label: `${min ? formatINR(+min) : "₹0"} – ${max ? formatINR(+max) : "any"}`, clear: () => { const n = new URLSearchParams(params); n.delete("min"); n.delete("max"); setParams(n, { replace: true }); } });
    if (showSold) c.push({ label: "Including sold", clear: () => setParam("sold", null) });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, catName]);

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  const filters = (
    <div className="space-y-7">
      <fieldset>
        <legend className="font-semibold text-gray-800 mb-3">Category</legend>
        <div className="space-y-1">
          {[{ slug: "", name: "All categories" }, ...categories].map((c) => (
            <button key={c.slug || "all"} onClick={() => setParam("category", c.slug)} aria-pressed={category === c.slug}
              className={`block w-full text-left px-3 py-1.5 rounded-md text-sm ${category === c.slug ? "bg-green-100 text-green-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}>
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-gray-800 mb-3">Listing type</legend>
        <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg" role="radiogroup">
          {[["all", "All"], ["sell", "For sale"], ["donate", "Free"]].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={type === v} onClick={() => setParam("type", v)}
              className={`text-sm py-1.5 rounded-md ${type === v ? "bg-white shadow text-green-800 font-medium" : "text-gray-600"}`}>{l}</button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-gray-800 mb-3">Condition</legend>
        <div className="space-y-2">
          {CONDITIONS.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <Checkbox id={`cond-${c}`} checked={conditions.includes(c)}
                onCheckedChange={(on) => setParam("condition", (on ? [...conditions, c] : conditions.filter((x) => x !== c)).join(","))} />
              <Label htmlFor={`cond-${c}`} className="text-sm font-normal cursor-pointer">{c}</Label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-gray-800 mb-3">Price</legend>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRICE_PRESETS.map((p) => {
            const active = min === p.min && max === p.max;
            return (
              <button key={p.label} aria-pressed={active}
                onClick={() => { const n = new URLSearchParams(params); active ? (n.delete("min"), n.delete("max")) : (p.min ? n.set("min", p.min) : n.delete("min"), p.max ? n.set("max", p.max) : n.delete("max")); setParams(n, { replace: true }); }}
                className={`text-xs px-3 py-1.5 rounded-full border ${active ? "bg-green-600 text-white border-green-600" : "hover:border-green-500"}`}>{p.label}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="min-price">Minimum price</label>
          <input id="min-price" type="number" min={0} inputMode="numeric" placeholder="Min ₹" defaultValue={min} key={`min${min}`}
            onBlur={(e) => setParam("min", e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" />
          <span className="text-gray-400">–</span>
          <label className="sr-only" htmlFor="max-price">Maximum price</label>
          <input id="max-price" type="number" min={0} inputMode="numeric" placeholder="Max ₹" defaultValue={max} key={`max${max}`}
            onBlur={(e) => setParam("max", e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" />
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <Checkbox id="show-sold" checked={showSold} onCheckedChange={(on) => setParam("sold", on ? "1" : null)} />
        <Label htmlFor="show-sold" className="text-sm font-normal cursor-pointer">Show sold &amp; given-away items</Label>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Shop", to: catName ? "/shop" : undefined }, ...(catName ? [{ label: catName }] : [])]} />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">{q ? `Results for “${q}”` : catName ?? "All items"}</h1>
          <p className="text-gray-600 mt-1" aria-live="polite">{loading ? "Searching…" : `${total} ${total === 1 ? "item" : "items"} found`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden gap-2"><SlidersHorizontal className="h-4 w-4" />Filters{chips.length ? ` (${chips.length})` : ""}</Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="px-4 pb-6">{filters}</div>
            </SheetContent>
          </Sheet>
          <label htmlFor="sort" className="text-sm text-gray-600 hidden sm:block">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? null : e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-white">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6" aria-label="Active filters">
          {chips.map((c) => (
            <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 rounded-full pl-3 pr-2 py-1 text-sm hover:bg-green-100" aria-label={`Remove filter ${c.label}`}>
              {c.label}<X className="h-3.5 w-3.5" />
            </button>
          ))}
          <button onClick={clearAll} className="text-sm text-gray-600 underline ml-1">Clear all</button>
        </div>
      )}

      <div className="flex gap-8">
        <aside className="hidden lg:block w-60 shrink-0" aria-label="Filters">{filters}</aside>
        <div className="flex-1 min-w-0">
          {error ? <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params))} />
            : loading ? <GridSkeleton count={8} />
            : items.length === 0 ? (
              <EmptyState icon={<PackageSearch className="h-8 w-8" />} title="No items match"
                text={chips.length ? "Try removing a filter or searching for something broader." : "Nothing has been listed yet. Be the first!"}
                action={chips.length ? <Button onClick={clearAll} className="bg-green-600 hover:bg-green-700">Clear all filters</Button>
                  : <Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/sell">List an item</Link></Button>} />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {items.map((it) => <ItemCard key={it.id} item={it} />)}
                </div>
                <div className="text-center mt-10">
                  <p className="text-sm text-gray-500 mb-3">Showing {items.length} of {total}</p>
                  {items.length < total && (
                    <Button onClick={loadMore} disabled={loadingMore} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                      {loadingMore ? "Loading…" : "Load more"}
                    </Button>
                  )}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
