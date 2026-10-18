import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shirt, Gift, Cloud, Droplets, Users, ShoppingBag, Star, Recycle, MapPin, HeartHandshake, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, ErrorState, StarRating } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase, friendlyError } from "@/lib/supabase";
import { formatINR, formatNumber, timeAgo } from "@/lib/format";
import type { ImpactStats } from "@/lib/types";

interface Data {
  impact: ImpactStats;
  members: number;
  orders: number;
  gmv: number;
  reviews: number;
  avgRating: number;
  listed: number;
  forSale: number;
  forDonation: number;
  byCategory: { name: string; listed: number; rehomed: number }[];
  cities: { city: string; members: number }[];
  ngos: { name: string; city: string; items: number }[];
  milestones: { title: string; status: string; city: string | null; when: string }[];
}

/** Single-series horizontal bar with value label (one hue = magnitude). */
function Bar({ label, value, max, suffix = "", tone = "bg-green-600" }: { label: string; value: number; max: number; suffix?: string; tone?: string }) {
  const pct = max ? Math.max(2, (value / max) * 100) : 0;
  return (
    <li className="grid grid-cols-[120px_1fr_64px] items-center gap-3 text-sm" title={`${label}: ${formatNumber(value)}${suffix}`}>
      <span className="truncate text-gray-700">{label}</span>
      <span className="h-3 bg-gray-100 rounded-full overflow-hidden" aria-hidden>
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-gray-800 tabular-nums text-right">{formatNumber(value)}{suffix}</span>
    </li>
  );
}

export default function Impact() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [impact, items, cats, people, orders, reviews, ngos] = await Promise.all([
        supabase.from("v_impact_stats").select("*").single(),
        supabase.from("items").select("title, status, listing_type, category_id, ngo_id, seller_id, updated_at"),
        supabase.from("categories").select("id, name").order("sort_order"),
        supabase.from("v_public_profiles").select("id, city"),
        supabase.from("v_public_orders").select("total, status"),
        supabase.from("reviews").select("rating"),
        supabase.from("ngos").select("id, name, city").eq("is_active", true),
      ]);
      const err = [impact, items, cats, people, orders, reviews, ngos].find((r) => r.error)?.error;
      if (err) throw err;

      type It = { title: string; status: string; listing_type: string; category_id: number; ngo_id: number | null; seller_id: string; updated_at: string };
      const its = (items.data ?? []) as It[];
      const live = its.filter((i) => i.status !== "removed");
      const rehomed = (s: string) => s === "sold" || s === "donated";
      const cityOf = new Map((people.data ?? []).map((p: { id: string; city: string | null }) => [p.id, p.city]));

      const cityCount: Record<string, number> = {};
      (people.data ?? []).forEach((p: { city: string | null }) => { if (p.city) cityCount[p.city] = (cityCount[p.city] ?? 0) + 1; });

      const ords = ((orders.data ?? []) as { total: number; status: string }[]).filter((o) => o.status !== "cancelled");
      const revs = (reviews.data ?? []) as { rating: number }[];

      setData({
        impact: impact.data as ImpactStats,
        members: people.data?.length ?? 0,
        orders: ords.length,
        gmv: ords.reduce((s, o) => s + Number(o.total), 0),
        reviews: revs.length,
        avgRating: revs.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0,
        listed: live.length,
        forSale: live.filter((i) => i.listing_type === "sell").length,
        forDonation: live.filter((i) => i.listing_type === "donate").length,
        byCategory: ((cats.data ?? []) as { id: number; name: string }[]).map((c) => ({
          name: c.name,
          listed: live.filter((i) => i.category_id === c.id).length,
          rehomed: live.filter((i) => i.category_id === c.id && rehomed(i.status)).length,
        })),
        cities: Object.entries(cityCount).map(([city, members]) => ({ city, members })).sort((a, b) => b.members - a.members).slice(0, 6),
        ngos: ((ngos.data ?? []) as { id: number; name: string; city: string }[]).map((n) => ({
          name: n.name, city: n.city, items: live.filter((i) => i.ngo_id === n.id).length,
        })),
        milestones: live.filter((i) => rehomed(i.status)).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5)
          .map((i) => ({ title: i.title, status: i.status, city: cityOf.get(i.seller_id) ?? null, when: i.updated_at })),
      });
    } catch (e) { setError(friendlyError(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // quietly refresh numbers when anything changes on the platform
  useEffect(() => {
    const ch = supabase.channel("impact-refresh")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (error) return <div className="container mx-auto px-4 py-10"><ErrorState message={error} onRetry={load} /></div>;

  const d = data;
  const hero = [
    { icon: Shirt, value: d ? formatNumber(d.impact.items_rehomed) : null, label: "Items given a second life" },
    { icon: Cloud, value: d ? `${formatNumber(d.impact.co2_saved_kg)} kg` : null, label: "CO₂ emissions avoided*" },
    { icon: Droplets, value: d ? `${formatNumber(d.impact.water_saved_litres)} L` : null, label: "Water saved*" },
    { icon: Scale, value: d ? `${formatNumber(d.impact.kg_saved)} kg` : null, label: "Textiles kept from landfill" },
  ];
  const community = [
    { icon: Users, value: d ? formatNumber(d.members) : null, label: "Community members" },
    { icon: Recycle, value: d ? formatNumber(d.listed) : null, label: "Items listed" },
    { icon: ShoppingBag, value: d ? formatNumber(d.orders) : null, label: "Orders completed" },
    { icon: Gift, value: d ? formatNumber(d.impact.items_donated) : null, label: "Items donated" },
    { icon: Star, value: d ? (d.avgRating ? d.avgRating.toFixed(1) : "–") : null, label: `Average rating (${d?.reviews ?? 0} reviews)` },
    { icon: Sparkles, value: d ? formatINR(d.gmv) : null, label: "Earned by sellers" },
  ];
  const maxCat = Math.max(1, ...(d?.byCategory.map((c) => c.listed) ?? [1]));
  const maxCity = Math.max(1, ...(d?.cities.map((c) => c.members) ?? [1]));
  const salePct = d && d.listed ? Math.round((d.forSale / d.listed) * 100) : 0;

  return (
    <div>
      <section className="bg-gradient-to-r from-green-50 to-blue-50 py-12">
        <div className="container mx-auto px-4">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Our Impact" }]} />
          <h1 className="text-4xl font-semibold text-gray-800">Our Impact</h1>
          <p className="text-gray-600 mt-2 max-w-2xl">Every item bought, sold or donated on EcoThreads keeps clothing in use and out of landfill. These numbers update automatically as our community grows.</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {hero.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 shadow-sm">
                <s.icon className="h-8 w-8 text-green-600 mb-3" aria-hidden />
                {s.value === null ? <Skeleton className="h-9 w-24" /> : <div className="text-3xl font-semibold text-gray-800">{s.value}</div>}
                <div className="text-sm text-gray-600 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 space-y-12">
        <section aria-labelledby="community-h">
          <h2 id="community-h" className="text-2xl font-semibold text-gray-800 mb-6">Our community in numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {community.map((s) => (
              <div key={s.label} className="border rounded-xl p-4 bg-white">
                <s.icon className="h-5 w-5 text-green-600 mb-2" aria-hidden />
                {s.value === null ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-semibold text-gray-800">{s.value}</div>}
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-8">
          <section className="border rounded-2xl p-6 bg-white" aria-labelledby="cat-h">
            <h2 id="cat-h" className="text-lg font-semibold text-gray-800">Items listed by category</h2>
            <p className="text-sm text-gray-500 mb-5">How many pieces each category has brought to the platform.</p>
            {d ? (
              <ul className="space-y-3">{d.byCategory.map((c) => <Bar key={c.name} label={c.name} value={c.listed} max={maxCat} />)}</ul>
            ) : <Skeleton className="h-32 w-full" />}
            {d && (
              <p className="text-sm text-gray-600 mt-5">
                {d.byCategory.map((c) => `${c.name}: ${c.rehomed} re-homed`).join(" · ")}
              </p>
            )}
          </section>

          <section className="border rounded-2xl p-6 bg-white" aria-labelledby="split-h">
            <h2 id="split-h" className="text-lg font-semibold text-gray-800">Sold vs donated</h2>
            <p className="text-sm text-gray-500 mb-5">Share of listings offered for sale and for free.</p>
            {d ? (
              <>
                <div className="flex h-8 rounded-full overflow-hidden gap-0.5" role="img" aria-label={`${salePct}% for sale, ${100 - salePct}% donated`}>
                  <div className="bg-green-600" style={{ width: `${salePct}%` }} title={`For sale: ${d.forSale}`} />
                  <div className="bg-rose-400" style={{ width: `${100 - salePct}%` }} title={`Donated: ${d.forDonation}`} />
                </div>
                <ul className="flex flex-wrap gap-6 mt-4 text-sm">
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-green-600" aria-hidden /><span className="text-gray-700">For sale</span><span className="font-semibold text-gray-800">{d.forSale} ({salePct}%)</span></li>
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-rose-400" aria-hidden /><span className="text-gray-700">Donated</span><span className="font-semibold text-gray-800">{d.forDonation} ({100 - salePct}%)</span></li>
                </ul>
              </>
            ) : <Skeleton className="h-16 w-full" />}

            <h3 className="text-base font-semibold text-gray-800 mt-8 mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-green-600" />Members by city</h3>
            {d ? (d.cities.length ? <ul className="space-y-3">{d.cities.map((c) => <Bar key={c.city} label={c.city} value={c.members} max={maxCity} />)}</ul>
              : <p className="text-sm text-gray-500">No cities yet.</p>) : <Skeleton className="h-24 w-full" />}
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <section className="border rounded-2xl p-6 bg-white" aria-labelledby="ngo-h">
            <h2 id="ngo-h" className="text-lg font-semibold text-gray-800 flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-rose-500" />Our NGO partners</h2>
            <p className="text-sm text-gray-500 mb-5">Donations that go unclaimed are picked up for these organisations.</p>
            <ul className="divide-y">
              {(d?.ngos ?? []).map((n) => (
                <li key={n.name} className="py-3 flex justify-between gap-3 text-sm">
                  <span><span className="font-medium text-gray-800">{n.name}</span><span className="block text-gray-500">{n.city}</span></span>
                  <span className="text-gray-700 self-center">{n.items} {n.items === 1 ? "item" : "items"} pledged</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border rounded-2xl p-6 bg-white" aria-labelledby="ms-h">
            <h2 id="ms-h" className="text-lg font-semibold text-gray-800">Recently found a new home</h2>
            <p className="text-sm text-gray-500 mb-5">The latest items our community has sold or donated.</p>
            {d && d.milestones.length === 0 && <p className="text-sm text-gray-500">Nothing yet — be the first!</p>}
            <ul className="space-y-3">
              {(d?.milestones ?? []).map((m, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${m.status === "donated" ? "bg-rose-400" : "bg-green-600"}`} aria-hidden />
                  <span className="flex-1"><span className="font-medium text-gray-800">{m.title}</span> was {m.status}{m.city ? ` by a member in ${m.city}` : ""}</span>
                  <span className="text-gray-400 text-xs whitespace-nowrap">{timeAgo(m.when)}</span>
                </li>
              ))}
            </ul>
            {d && d.avgRating > 0 && (
              <p className="mt-6 text-sm text-gray-600 flex items-center gap-2"><StarRating rating={d.avgRating} />Buyers rate their experience {d.avgRating.toFixed(1)} out of 5</p>
            )}
          </section>
        </div>

        <section className="text-center bg-green-50 rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800">Add to these numbers</h2>
          <p className="text-gray-600 mt-2">List something you no longer wear, or find your next favourite piece.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/sell">Sell or donate</Link></Button>
            <Button asChild variant="outline" className="border-green-600 text-green-700"><Link to="/shop">Start shopping</Link></Button>
          </div>
          <p className="text-xs text-gray-500 mt-6">*Estimates based on commonly cited figures: about 15 kg CO₂ and 10,000 L of water saved per kg of clothing re-used instead of bought new.</p>
        </section>
      </div>
    </div>
  );
}
