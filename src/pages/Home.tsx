import { Link } from "react-router-dom";
import { ArrowRight, Recycle, Droplets, Cloud, Shirt, Upload, Truck, ShieldCheck, Gift, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemCard } from "@/components/ItemCard";
import { GridSkeleton, SafeImage, SectionTitle, StarRating, ErrorState } from "@/components/common";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import { formatNumber, timeAgo } from "@/lib/format";
import { getRecent } from "@/lib/recent";
import type { Category, ImpactStats, ItemFull, Review } from "@/lib/types";

function Hero() {
  return (
    <section className="bg-gradient-to-r from-green-50 to-blue-50 py-14 md:py-20">
      <div className="container mx-auto px-4 flex flex-col lg:flex-row items-center gap-10">
        <div className="lg:w-1/2">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-800 leading-tight mb-6">
            Sustainable Fashion for a <span className="text-green-600">Better Tomorrow</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Give your clothes a second life. Buy, sell, or donate pre-loved fashion and help reduce textile waste
            while building a sustainable community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild className="bg-green-600 hover:bg-green-700 px-8 h-12 text-base">
              <Link to="/shop">Start Shopping <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-green-600 text-green-700 hover:bg-green-50 px-8 h-12 text-base">
              <Link to="/sell"><Recycle className="mr-2 h-4 w-4" />Sell or Donate</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-gray-500 flex items-center gap-2">
            <Search className="h-4 w-4" aria-hidden /> Tip: press <kbd className="border rounded px-1.5 bg-white">/</kbd> to search, or tap the mic to search by voice.
          </p>
        </div>
        <div className="lg:w-1/2 flex justify-center">
          <SafeImage
            src="https://images.unsplash.com/photo-1655252205273-844a139fd348?w=1080&q=80"
            alt="Pre-loved clothes hanging on a rail"
            className="rounded-2xl shadow-xl max-w-md w-full aspect-[4/3] object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function ImpactStrip() {
  const { data } = useAsync(async () => {
    const { data, error } = await supabase.from("v_impact_stats").select("*").single();
    if (error) throw error;
    return data as ImpactStats;
  }, []);
  const stats = [
    { icon: Shirt, value: data ? formatNumber(data.items_rehomed) : "–", label: "Items re-homed" },
    { icon: Gift, value: data ? formatNumber(data.items_donated) : "–", label: "Donations listed" },
    { icon: Cloud, value: data ? `${formatNumber(data.co2_saved_kg)} kg` : "–", label: "CO₂ saved (est.)" },
    { icon: Droplets, value: data ? `${formatNumber(data.water_saved_litres)} L` : "–", label: "Water saved (est.)" },
  ];
  return (
    <section aria-label="Our community impact" className="border-y bg-white">
      <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
        {stats.map((s) => (
          <div key={s.label} className="py-6 px-4 flex items-center gap-3 justify-center">
            <s.icon className="h-7 w-7 text-green-600 shrink-0" aria-hidden />
            <div>
              <div className="text-xl font-semibold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Categories() {
  const { data, loading } = useAsync(async () => {
    const [cats, items] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("items").select("category_id").eq("status", "active"),
    ]);
    if (cats.error) throw cats.error;
    const counts: Record<number, number> = {};
    (items.data ?? []).forEach((r: { category_id: number }) => { counts[r.category_id] = (counts[r.category_id] ?? 0) + 1; });
    return (cats.data as Category[]).map((c) => ({ ...c, count: counts[c.id] ?? 0 }));
  }, []);

  return (
    <section id="browse" className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <SectionTitle title="Browse by Category" subtitle="Discover unique, pre-loved fashion pieces. Every purchase helps reduce textile waste." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {(loading ? Array.from({ length: 4 }) : data ?? []).map((c, i) => {
            const cat = c as (Category & { count: number }) | undefined;
            return cat ? (
              <Link key={cat.slug} to={`/shop?category=${cat.slug}`} className="group">
                <Card className="overflow-hidden hover:shadow-lg transition-shadow p-0 gap-0">
                  <div className="relative h-48 md:h-64 overflow-hidden">
                    <SafeImage src={cat.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="text-lg font-semibold">{cat.name}</h3>
                      <p className="text-sm opacity-90">{cat.count} {cat.count === 1 ? "item" : "items"} available</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ) : <div key={i} className="h-48 md:h-64 rounded-xl bg-gray-100 animate-pulse" />;
          })}
        </div>
      </div>
    </section>
  );
}

function ItemRow({ title, subtitle, link, linkLabel, loader, deps }: {
  title: string; subtitle: string; link: string; linkLabel: string; loader: () => Promise<ItemFull[]>; deps: unknown[];
}) {
  const { data, loading, error, reload } = useAsync(loader, deps);
  if (!loading && !error && (data?.length ?? 0) === 0) return null;
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <SectionTitle title={title} subtitle={subtitle}
          action={<Button asChild variant="outline" className="border-green-600 text-green-700"><Link to={link}>{linkLabel} <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>} />
        {error ? <ErrorState message={error} onRetry={reload} />
          : loading ? <GridSkeleton count={4} />
          : <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">{data!.map((it) => <ItemCard key={it.id} item={it} />)}</div>}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Upload, title: "List in 2 minutes", text: "Add photos, choose sell or donate, and set a price. We show a live preview as you type." },
    { icon: ShieldCheck, title: "Buy with confidence", text: "Honest condition labels, seller ratings and reviews from real buyers." },
    { icon: Truck, title: "Ship or donate", text: "Sold items ship to the buyer. Donations go to people in need or a partner NGO." },
  ];
  return (
    <section id="about" className="py-16 bg-green-50">
      <div className="container mx-auto px-4">
        <SectionTitle title="How EcoThreads works" subtitle="Three simple steps to keep clothes in use and out of landfill." />
        <ol className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <li key={s.title} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="h-9 w-9 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold">{i + 1}</span>
                <s.icon className="h-6 w-6 text-green-600" aria-hidden />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{s.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="text-center mt-8">
          <Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/sell">List your first item</Link></Button>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const { data } = useAsync(async () => {
    const { data: reviews, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(3);
    if (error) throw error;
    const ids = Array.from(new Set((reviews as Review[]).flatMap((r) => [r.reviewer_id, r.seller_id])));
    const itemIds = (reviews as Review[]).map((r) => r.item_id).filter(Boolean) as string[];
    const [people, items] = await Promise.all([
      supabase.from("v_public_profiles").select("id, full_name, city").in("id", ids),
      itemIds.length ? supabase.from("items").select("id, title").in("id", itemIds) : Promise.resolve({ data: [] }),
    ]);
    const nameOf = (id: string) => (people.data ?? []).find((p: { id: string }) => p.id === id) as { full_name: string; city: string | null } | undefined;
    const titleOf = (id: string | null) => ((items.data ?? []) as { id: string; title: string }[]).find((i) => i.id === id)?.title;
    return (reviews as Review[]).map((r) => ({ ...r, reviewer: nameOf(r.reviewer_id), seller: nameOf(r.seller_id), itemTitle: titleOf(r.item_id) }));
  }, []);

  if (!data?.length) return null;
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <SectionTitle title="Community Reviews & Trust" subtitle="Real reviews from buyers help everyone shop with confidence." />
        <div className="grid md:grid-cols-3 gap-6">
          {data.map((r) => (
            <figure key={r.id} className="border rounded-xl p-6 bg-white shadow-sm flex flex-col">
              <StarRating rating={r.rating} />
              <blockquote className="text-gray-700 mt-3 flex-1">“{r.comment}”</blockquote>
              <figcaption className="mt-4 text-sm">
                <div className="font-medium text-gray-800">{r.reviewer?.full_name ?? "A buyer"}{r.reviewer?.city ? `, ${r.reviewer.city}` : ""}</div>
                <div className="text-gray-500">
                  {r.itemTitle ? <>bought “{r.itemTitle}” · </> : null}from {r.seller?.full_name ?? "a seller"} · {timeAgo(r.created_at)}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const recent = getRecent();
  return (
    <>
      <Hero />
      <ImpactStrip />
      <Categories />
      <ItemRow
        title="Fresh arrivals" subtitle="The newest pre-loved pieces from our community." link="/shop?sort=newest" linkLabel="See all"
        deps={[]}
        loader={async () => {
          const { data, error } = await supabase.from("v_items_full").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(8);
          if (error) throw error; return data as ItemFull[];
        }}
      />
      <HowItWorks />
      <ItemRow
        title="Free to a good home" subtitle="Donated items anyone can request — no payment needed." link="/shop?type=donate" linkLabel="All free items"
        deps={[]}
        loader={async () => {
          const { data, error } = await supabase.from("v_items_full").select("*").eq("listing_type", "donate").eq("status", "active").limit(4);
          if (error) throw error; return data as ItemFull[];
        }}
      />
      {recent.length > 0 && (
        <ItemRow
          title="Recently viewed" subtitle="Pick up where you left off." link="/shop" linkLabel="Keep browsing"
          deps={[recent.join(",")]}
          loader={async () => {
            const { data, error } = await supabase.from("v_items_full").select("*").in("id", recent).limit(4);
            if (error) throw error;
            return (data as ItemFull[]).sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
          }}
        />
      )}
      <Reviews />
    </>
  );
}
