import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Heart, ShoppingBag, Gift, MapPin, Truck, ShieldCheck, Leaf, Zap, CheckCircle2, PackageX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ItemCard } from "@/components/ItemCard";
import { Breadcrumbs, EmptyState, ErrorState, SafeImage, StarRating } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/useAsync";
import { supabase, friendlyError } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { conditionStyle, formatDate, formatINR, formatNumber, FREE_SHIPPING_AT, timeAgo } from "@/lib/format";
import { pushRecent } from "@/lib/recent";
import type { ItemFull, Review } from "@/lib/types";

const CONDITION_HELP: Record<string, string> = {
  New: "Never worn, may still have tags.",
  "Like New": "Worn once or twice. No visible signs of wear.",
  Excellent: "Gently used. No flaws.",
  Good: "Used with minor signs of wear, described by the seller.",
  Fair: "Visible wear — check the photos and description.",
};

export default function ItemPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile, cartIds, wishIds, addToCart, toggleWishlist, openAuth } = useApp();
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const { data: item, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from("v_items_full").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as ItemFull | null;
  }, [id]);

  const { data: extras } = useAsync(async () => {
    if (!item) return null;
    const [rev, similar] = await Promise.all([
      supabase.from("reviews").select("*").eq("seller_id", item.seller_id).order("created_at", { ascending: false }).limit(5),
      supabase.from("v_items_full").select("*").eq("category_id", item.category_id).eq("status", "active").neq("id", item.id).limit(4),
    ]);
    const reviews = (rev.data ?? []) as Review[];
    const ids = reviews.map((r) => r.reviewer_id);
    const names = ids.length ? (await supabase.from("v_public_profiles").select("id, full_name").in("id", ids)).data ?? [] : [];
    return {
      reviews: reviews.map((r) => ({ ...r, name: (names as { id: string; full_name: string }[]).find((n) => n.id === r.reviewer_id)?.full_name ?? "Buyer" })),
      similar: (similar.data ?? []) as ItemFull[],
    };
  }, [item?.id]);

  useEffect(() => { if (item) pushRecent(item.id); setActive(0); }, [item]);
  useEffect(() => {
    if (item && window.location.hash === "#request") document.getElementById("request")?.scrollIntoView({ behavior: "smooth" });
  }, [item]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 grid md:grid-cols-2 gap-10">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32 w-full" /></div>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!item) {
    return <EmptyState icon={<PackageX className="h-8 w-8" />} title="Item not found" text="It may have been removed by the seller."
      action={<Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/shop">Browse other items</Link></Button>} />;
  }

  const images = item.images.length ? item.images : [item.cover_image];
  const isMine = profile?.id === item.seller_id;
  const available = item.status === "active";
  const inCart = cartIds.has(item.id);
  const saved = wishIds.has(item.id);
  const co2 = Math.round(item.weight_kg * 15);

  const buyNow = async () => {
    if (!profile) return openAuth("Sign in to buy this item");
    if (!inCart) await addToCart(item.id, item.title);
    navigate("/checkout");
  };

  const requestItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return openAuth("Sign in to request this free item");
    setRequesting(true);
    const { error } = await supabase.rpc("request_donation", { p_item_id: item.id, p_message: message.trim() || null });
    setRequesting(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setRequested(true);
    toast.success("Request sent! The donor will review it — you can track it in your dashboard.");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: item.category_name, to: `/shop?category=${item.category_slug}` }, { label: item.title }]} />

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border">
            <SafeImage src={images[active]} alt={`${item.title} — photo ${active + 1} of ${images.length}`} className={`w-full h-full object-cover ${available ? "" : "grayscale"}`} />
            {!available && <span className="absolute top-4 left-4 bg-gray-900 text-white text-sm px-3 py-1 rounded-full capitalize">{item.status}</span>}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3" role="tablist" aria-label="Photos">
              {images.map((src, i) => (
                <button key={i} role="tab" aria-selected={i === active} aria-label={`Show photo ${i + 1}`} onClick={() => setActive(i)}
                  className={`h-16 w-16 rounded-lg overflow-hidden border-2 ${i === active ? "border-green-600" : "border-transparent"}`}>
                  <SafeImage src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge className={conditionStyle[item.condition]}>{item.condition}</Badge>
            <Badge variant="outline">{item.category_name}</Badge>
            {item.listing_type === "donate" && <Badge className="bg-rose-100 text-rose-700">Donation</Badge>}
          </div>
          <h1 className="text-3xl font-semibold text-gray-800">{item.title}</h1>
          <p className="text-3xl font-semibold mt-3 text-green-700">
            {item.listing_type === "donate" ? <span className="text-rose-600">Free</span> : formatINR(item.price)}
          </p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-6 text-sm">
            {[["Size", item.size], ["Brand", item.brand], ["Colour", item.color], ["Listed", formatDate(item.created_at)]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-gray-500">{k}</dt><dd className="text-gray-800 font-medium">{v}</dd></div>
            ))}
          </dl>
          <p className="text-sm text-gray-600 mt-3"><span className="font-medium">{item.condition}:</span> {CONDITION_HELP[item.condition]}</p>

          {item.description && <p className="mt-6 text-gray-700 leading-relaxed whitespace-pre-line">{item.description}</p>}

          {/* Actions */}
          <div className="mt-8 space-y-3">
            {isMine ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                This is your listing. Manage it from <Link to="/account" className="underline font-medium">your dashboard</Link>.
              </div>
            ) : !available ? (
              <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-700">
                This item has already found a new home. <Link className="text-green-700 underline" to={`/shop?category=${item.category_slug}`}>See similar items</Link>
              </div>
            ) : item.listing_type === "sell" ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={buyNow} className="flex-1 h-12 bg-green-600 hover:bg-green-700 gap-2 text-base"><Zap className="h-4 w-4" />Buy now</Button>
                {inCart
                  ? <Button asChild variant="outline" className="flex-1 h-12 border-green-600 text-green-700 gap-2"><Link to="/cart"><CheckCircle2 className="h-4 w-4" />In cart — view</Link></Button>
                  : <Button onClick={() => addToCart(item.id, item.title)} variant="outline" className="flex-1 h-12 border-green-600 text-green-700 gap-2"><ShoppingBag className="h-4 w-4" />Add to cart</Button>}
              </div>
            ) : requested ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 flex gap-2" role="status">
                <CheckCircle2 className="h-5 w-5 shrink-0" />Request sent. Track it in <Link to="/account" className="underline">your dashboard</Link>.
              </div>
            ) : (
              <form id="request" onSubmit={requestItem} className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 space-y-3 scroll-mt-24">
                <Label htmlFor="req-msg" className="font-medium">Request this free item</Label>
                <Textarea id="req-msg" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Optional: a short note to the donor (e.g. who it's for)" className="bg-white" />
                <Button type="submit" disabled={requesting} className="w-full bg-rose-500 hover:bg-rose-600 gap-2"><Gift className="h-4 w-4" />{requesting ? "Sending…" : "Send request"}</Button>
              </form>
            )}
            <Button variant="ghost" onClick={() => toggleWishlist(item.id, item.title)} aria-pressed={saved} className="gap-2 text-gray-700">
              <Heart className={`h-4 w-4 ${saved ? "fill-red-500 text-red-500" : ""}`} />{saved ? "Saved to wishlist" : "Save to wishlist"}
            </Button>
          </div>

          <ul className="mt-6 grid sm:grid-cols-3 gap-3 text-xs text-gray-600">
            <li className="flex gap-2 items-start"><Truck className="h-4 w-4 text-green-600 shrink-0" />Free shipping on orders over {formatINR(FREE_SHIPPING_AT)}</li>
            <li className="flex gap-2 items-start"><ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />Refund if it doesn't match the description</li>
            <li className="flex gap-2 items-start"><Leaf className="h-4 w-4 text-green-600 shrink-0" />Saves about {formatNumber(co2)} kg CO₂ vs buying new</li>
          </ul>

          {/* Seller */}
          <section className="mt-8 border rounded-xl p-5" aria-labelledby="seller-h">
            <h2 id="seller-h" className="text-sm text-gray-500 mb-2">{item.listing_type === "donate" ? "Donated by" : "Sold by"}</h2>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-semibold">
                {item.seller_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div>
                <div className="font-medium text-gray-800">{item.seller_name}</div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  {item.seller_review_count > 0 ? <><StarRating rating={Number(item.seller_rating)} /> {item.seller_rating} ({item.seller_review_count})</> : "New seller"}
                  {item.seller_city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.seller_city}</span>}
                </div>
              </div>
            </div>
            {item.ngo_name && <p className="text-sm text-gray-600 mt-3">Unclaimed items go to <span className="font-medium">{item.ngo_name}</span>.</p>}
            {extras?.reviews.length ? (
              <ul className="mt-4 space-y-3 border-t pt-4">
                {extras.reviews.map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex items-center gap-2"><StarRating rating={r.rating} /><span className="text-gray-500">{r.name} · {timeAgo(r.created_at)}</span></div>
                    {r.comment && <p className="text-gray-700 mt-1">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>

      {extras?.similar.length ? (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">More in {item.category_name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">{extras.similar.map((s) => <ItemCard key={s.id} item={s} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
