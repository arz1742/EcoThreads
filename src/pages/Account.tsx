import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Package, Star, IndianRupee, Gift, ShoppingBag, User, Eye, EyeOff, Trash2, Check, X, Leaf } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, SafeImage, StarRating } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInPrompt } from "./Cart";
import { useAsync } from "@/hooks/useAsync";
import { supabase, friendlyError } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { formatDate, formatINR, formatNumber, timeAgo } from "@/lib/format";
import type { ItemFull, Order, Review } from "@/lib/types";

type OrderRow = Order & { order_items: { item_id: string; seller_id: string; price_at_purchase: number; items: { title: string } | null }[] };
type SaleRow = { id: number; price_at_purchase: number; items: { title: string } | null; orders: { order_number: string; status: string; city: string; created_at: string } | null };
type RequestRow = { id: string; item_id: string; requester_id: string; message: string | null; status: string; created_at: string; items: { title: string; seller_id: string; status: string } | null };

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800", sold: "bg-blue-100 text-blue-800", donated: "bg-rose-100 text-rose-800",
  removed: "bg-gray-200 text-gray-700", reserved: "bg-yellow-100 text-yellow-800",
  placed: "bg-yellow-100 text-yellow-800", shipped: "bg-blue-100 text-blue-800", delivered: "bg-green-100 text-green-800", cancelled: "bg-gray-200 text-gray-700",
  pending: "bg-yellow-100 text-yellow-800", approved: "bg-green-100 text-green-800", rejected: "bg-gray-200 text-gray-700", completed: "bg-green-100 text-green-800",
};

export default function Account() {
  const { profile, loadingAuth, refreshProfile } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "listings";
  const [reviewFor, setReviewFor] = useState<{ order: OrderRow; sellerId: string; itemId: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ItemFull | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!profile) return null;
    const me = profile.id;
    const [listings, orders, sales, reqIn, reqOut, reviewsIn, reviewsOut] = await Promise.all([
      supabase.from("v_items_full").select("*").eq("seller_id", me).order("created_at", { ascending: false }),
      supabase.from("orders").select("*, order_items(item_id, seller_id, price_at_purchase, items(title))").eq("buyer_id", me).order("created_at", { ascending: false }),
      supabase.from("order_items").select("id, price_at_purchase, items(title), orders(order_number, status, city, created_at)").eq("seller_id", me),
      supabase.from("donation_requests").select("*, items!inner(title, seller_id, status)").eq("items.seller_id", me).order("created_at", { ascending: false }),
      supabase.from("donation_requests").select("*, items(title, seller_id, status)").eq("requester_id", me).order("created_at", { ascending: false }),
      supabase.from("reviews").select("*").eq("seller_id", me).order("created_at", { ascending: false }),
      supabase.from("reviews").select("item_id").eq("reviewer_id", me),
    ]);
    const firstErr = [listings, orders, sales, reqIn, reqOut, reviewsIn, reviewsOut].find((r) => r.error)?.error;
    if (firstErr) throw firstErr;
    const requesterIds = (reqIn.data ?? []).map((r: RequestRow) => r.requester_id);
    const reviewerIds = (reviewsIn.data ?? []).map((r: Review) => r.reviewer_id);
    const people = [...requesterIds, ...reviewerIds].length
      ? (await supabase.from("v_public_profiles").select("id, full_name, city").in("id", [...requesterIds, ...reviewerIds])).data ?? [] : [];
    const nameOf = (id: string) => (people as { id: string; full_name: string; city: string | null }[]).find((p) => p.id === id);
    return {
      listings: listings.data as ItemFull[],
      orders: orders.data as unknown as OrderRow[],
      sales: sales.data as unknown as SaleRow[],
      reqIn: reqIn.data as unknown as RequestRow[],
      reqOut: reqOut.data as unknown as RequestRow[],
      reviewsIn: reviewsIn.data as Review[],
      reviewedItems: new Set((reviewsOut.data ?? []).map((r: { item_id: string }) => r.item_id)),
      nameOf,
    };
  }, [profile?.id]);

  if (loadingAuth) return null;
  if (!profile) return <div className="container mx-auto px-4 py-8"><SignInPrompt what="dashboard" /></div>;

  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) { toast.error(friendlyError(error)); return false; }
    toast.success(ok); reload(); return true;
  };

  const setItemStatus = (it: ItemFull, status: string) =>
    act(supabase.from("items").update({ status }).eq("id", it.id),
      status === "removed" ? `"${it.title}" is hidden from the shop` : `"${it.title}" is visible again`);

  const deleteItem = async (it: ItemFull) => {
    setConfirmDelete(null);
    await act(supabase.from("items").delete().eq("id", it.id), `Deleted "${it.title}"`);
  };

  const decideRequest = async (r: RequestRow, approve: boolean) => {
    if (approve) {
      const ok = await act(supabase.from("donation_requests").update({ status: "approved" }).eq("id", r.id), "Request approved — the item is marked as donated");
      if (ok) await supabase.from("items").update({ status: "donated" }).eq("id", r.item_id);
      // politely close other pending requests for the same item
      await supabase.from("donation_requests").update({ status: "rejected" }).eq("item_id", r.item_id).eq("status", "pending");
      reload();
    } else {
      await act(supabase.from("donation_requests").update({ status: "rejected" }).eq("id", r.id), "Request declined");
    }
  };

  const stats = data ? {
    listed: data.listings.filter((i) => i.status !== "removed").length,
    earned: data.sales.reduce((s, x) => s + Number(x.price_at_purchase), 0),
    rating: data.reviewsIn.length ? (data.reviewsIn.reduce((s, r) => s + r.rating, 0) / data.reviewsIn.length) : 0,
    rehomed: data.listings.filter((i) => i.status === "sold" || i.status === "donated").length,
    co2: data.listings.filter((i) => i.status === "sold" || i.status === "donated").reduce((s, i) => s + Number(i.weight_kg) * 15, 0),
  } : null;
  const pendingIn = data?.reqIn.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">Hi, {profile.full_name.split(" ")[0]} 👋</h1>
          <p className="text-gray-600">Manage your listings, orders and donations in one place.</p>
        </div>
        <Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/sell">+ List a new item</Link></Button>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Package, label: "Active listings", value: stats ? formatNumber(stats.listed) : "–", c: "text-green-600" },
              { icon: IndianRupee, label: "Earned from sales", value: stats ? formatINR(stats.earned) : "–", c: "text-blue-600" },
              { icon: Star, label: "Seller rating", value: stats ? (stats.rating ? stats.rating.toFixed(1) : "New") : "–", c: "text-yellow-500" },
              { icon: Leaf, label: "CO₂ you've saved", value: stats ? `${formatNumber(stats.co2)} kg` : "–", c: "text-emerald-600" },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.c}`} aria-hidden />
                <div><div className="text-xl font-semibold text-gray-800">{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></div>
              </CardContent></Card>
            ))}
          </div>

          <Tabs value={tab} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="listings">My listings</TabsTrigger>
              <TabsTrigger value="orders">My orders</TabsTrigger>
              <TabsTrigger value="sales">My sales</TabsTrigger>
              <TabsTrigger value="donations">Donations {pendingIn > 0 && <span className="ml-1 bg-rose-500 text-white rounded-full text-[10px] px-1.5">{pendingIn}</span>}</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            {loading || !data ? <div className="space-y-3 mt-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div> : (
              <>
                <TabsContent value="listings" className="mt-6">
                  {!data.listings.length ? <EmptyState icon={<Package className="h-8 w-8" />} title="No listings yet" text="List something you no longer wear — it takes two minutes."
                    action={<Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/sell">List an item</Link></Button>} /> : (
                    <ul className="space-y-3">
                      {data.listings.map((it) => (
                        <li key={it.id} className="flex items-center gap-4 border rounded-xl p-3 bg-white">
                          <SafeImage src={it.cover_image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          <div className="flex-1 min-w-0">
                            <Link to={`/item/${it.id}`} className="font-medium text-gray-800 hover:text-green-700">{it.title}</Link>
                            <p className="text-sm text-gray-500">{it.listing_type === "donate" ? "Donation" : formatINR(it.price)} · listed {timeAgo(it.created_at)}</p>
                          </div>
                          <Badge className={`capitalize ${statusColor[it.status]}`}>{it.status === "removed" ? "hidden" : it.status}</Badge>
                          <div className="flex gap-1">
                            {it.status === "active" && <Button size="sm" variant="ghost" onClick={() => setItemStatus(it, "removed")} aria-label={`Hide ${it.title}`} title="Hide from shop"><EyeOff className="h-4 w-4" /></Button>}
                            {it.status === "removed" && <Button size="sm" variant="ghost" onClick={() => setItemStatus(it, "active")} aria-label={`Show ${it.title}`} title="Show in shop"><Eye className="h-4 w-4" /></Button>}
                            {(it.status === "active" || it.status === "removed") &&
                              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(it)} aria-label={`Delete ${it.title}`} title="Delete"><Trash2 className="h-4 w-4" /></Button>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="orders" className="mt-6">
                  {!data.orders.length ? <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title="No orders yet" text="Items you buy will appear here."
                    action={<Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/shop">Start shopping</Link></Button>} /> : (
                    <ul className="space-y-4">
                      {data.orders.map((o) => (
                        <li key={o.id} className="border rounded-xl p-4 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div><span className="font-mono font-semibold">{o.order_number}</span><span className="text-sm text-gray-500 ml-2">{formatDate(o.created_at)}</span></div>
                            <div className="flex items-center gap-2">
                              <Badge className={`capitalize ${statusColor[o.status]}`}>{o.status}</Badge>
                              <span className="font-semibold">{formatINR(o.total)}</span>
                            </div>
                          </div>
                          <ul className="text-sm divide-y">
                            {o.order_items.map((oi) => (
                              <li key={oi.item_id} className="py-2 flex items-center justify-between gap-2">
                                <Link to={`/item/${oi.item_id}`} className="hover:text-green-700">{oi.items?.title ?? "Item"}</Link>
                                {o.status === "delivered" && (data.reviewedItems.has(oi.item_id)
                                  ? <span className="text-xs text-gray-500 flex items-center gap-1"><Check className="h-3 w-3" />Reviewed</span>
                                  : <Button size="sm" variant="outline" onClick={() => setReviewFor({ order: o, sellerId: oi.seller_id, itemId: oi.item_id, title: oi.items?.title ?? "item" })}>Rate seller</Button>)}
                              </li>
                            ))}
                          </ul>
                          {(o.status === "placed" || o.status === "shipped") && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => act(supabase.from("orders").update({ status: "delivered" }).eq("id", o.id), "Marked as received — you can now rate the seller")}>I've received it</Button>
                              {o.status === "placed" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act(supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id), "Order cancelled")}>Cancel order</Button>}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="sales" className="mt-6">
                  {!data.sales.length ? <EmptyState icon={<IndianRupee className="h-8 w-8" />} title="No sales yet" text="When someone buys your item, you'll see it here with the delivery city." /> : (
                    <ul className="divide-y border rounded-xl bg-white">
                      {data.sales.map((s) => (
                        <li key={s.id} className="p-4 flex items-center justify-between gap-2 text-sm">
                          <span><span className="font-medium">{s.items?.title}</span><span className="block text-gray-500">{s.orders?.order_number} · to {s.orders?.city} · {s.orders ? timeAgo(s.orders.created_at) : ""}</span></span>
                          <span className="flex items-center gap-2"><Badge className={`capitalize ${statusColor[s.orders?.status ?? ""]}`}>{s.orders?.status}</Badge><span className="font-semibold">{formatINR(s.price_at_purchase)}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="donations" className="mt-6 space-y-8">
                  <section>
                    <h2 className="font-semibold mb-3">Requests for your donations</h2>
                    {!data.reqIn.length ? <p className="text-sm text-gray-500">No requests yet.</p> : (
                      <ul className="space-y-3">
                        {data.reqIn.map((r) => {
                          const who = data.nameOf(r.requester_id);
                          return (
                            <li key={r.id} className="border rounded-xl p-4 bg-white flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                              <div className="text-sm">
                                <p><span className="font-medium">{who?.full_name ?? "Someone"}</span>{who?.city ? ` from ${who.city}` : ""} wants <span className="font-medium">{r.items?.title}</span></p>
                                {r.message && <p className="text-gray-600 mt-1">“{r.message}”</p>}
                                <p className="text-xs text-gray-400 mt-1">{timeAgo(r.created_at)}</p>
                              </div>
                              {r.status === "pending" ? (
                                <div className="flex gap-2">
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => decideRequest(r, true)}><Check className="h-4 w-4" />Approve</Button>
                                  <Button size="sm" variant="outline" className="gap-1" onClick={() => decideRequest(r, false)}><X className="h-4 w-4" />Decline</Button>
                                </div>
                              ) : <Badge className={`capitalize ${statusColor[r.status]}`}>{r.status}</Badge>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h2 className="font-semibold mb-3">Items you've requested</h2>
                    {!data.reqOut.length ? <p className="text-sm text-gray-500">You haven't requested any free items. <Link className="text-green-700 underline" to="/shop?type=donate">Browse free items</Link></p> : (
                      <ul className="divide-y border rounded-xl bg-white">
                        {data.reqOut.map((r) => (
                          <li key={r.id} className="p-4 flex items-center justify-between text-sm">
                            <Link to={`/item/${r.item_id}`} className="hover:text-green-700">{r.items?.title}</Link>
                            <Badge className={`capitalize ${statusColor[r.status]}`}>{r.status === "pending" ? "waiting for donor" : r.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="reviews" className="mt-6">
                  {!data.reviewsIn.length ? <EmptyState icon={<Star className="h-8 w-8" />} title="No reviews yet" text="Buyers can rate you after they receive your item." /> : (
                    <ul className="space-y-3">
                      {data.reviewsIn.map((r) => (
                        <li key={r.id} className="border rounded-xl p-4 bg-white">
                          <div className="flex items-center gap-2"><StarRating rating={r.rating} /><span className="text-sm text-gray-500">{data.nameOf(r.reviewer_id)?.full_name ?? "Buyer"} · {timeAgo(r.created_at)}</span></div>
                          {r.comment && <p className="text-gray-700 mt-2 text-sm">{r.comment}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="profile" className="mt-6"><ProfileForm onSaved={refreshProfile} /></TabsContent>
              </>
            )}
          </Tabs>
        </>
      )}

      {/* Confirm before destructive actions */}
      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>“{confirmDelete?.title}” will be permanently removed. If you might list it again, choose “Hide” instead.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { if (confirmDelete) setItemStatus(confirmDelete, "removed"); setConfirmDelete(null); }}>Hide instead</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteItem(confirmDelete)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {reviewFor && <ReviewDialog target={reviewFor} onClose={() => setReviewFor(null)} onDone={() => { setReviewFor(null); reload(); }} />}
    </div>
  );
}

function ReviewDialog({ target, onClose, onDone }: { target: { order: OrderRow; sellerId: string; itemId: string; title: string }; onClose: () => void; onDone: () => void }) {
  const { profile } = useApp();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  const submit = async () => {
    if (!rating) { toast.error("Please choose a star rating"); return; }
    setBusy(true);
    const { error } = await supabase.from("reviews").insert({
      reviewer_id: profile!.id, seller_id: target.sellerId, item_id: target.itemId, order_id: target.order.id, rating, comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Thanks for your review!");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Rate your experience</DialogTitle><DialogDescription>For “{target.title}”. Honest reviews help everyone.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} role="radio" aria-checked={rating === s} aria-label={`${s} star${s > 1 ? "s" : ""} — ${labels[s]}`}
              onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}>
              <Star className={`h-8 w-8 ${s <= (hover || rating) ? "text-yellow-400 fill-current" : "text-gray-300"}`} />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-600">{labels[hover || rating]}</span>
        </div>
        <Label htmlFor="rv-comment">Comment <span className="text-gray-400 font-normal">(optional)</span></Label>
        <Textarea id="rv-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Item condition, packing, communication…" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-green-600 hover:bg-green-700">{busy ? "Posting…" : "Post review"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { profile } = useApp();
  const [f, setF] = useState({ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "", city: profile?.city ?? "", bio: profile?.bio ?? "" });
  const [busy, setBusy] = useState(false);
  const phoneBad = f.phone && !/^[6-9]\d{9}$/.test(f.phone);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.full_name.trim().length < 2) { toast.error("Name can't be empty"); return; }
    if (phoneBad) { toast.error("Mobile number should be 10 digits"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name.trim(), phone: f.phone || null, city: f.city.trim() || null, bio: f.bio.trim() || null,
    }).eq("id", profile!.id);
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    await onSaved();
    toast.success("Profile saved");
  };

  return (
    <form onSubmit={save} className="max-w-lg space-y-4 border rounded-xl p-6 bg-white">
      <div className="flex items-center gap-2 text-gray-700"><User className="h-5 w-5" /><span className="text-sm">{profile?.email}</span></div>
      <div><Label htmlFor="p-name">Full name</Label><Input id="p-name" className="mt-1" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div>
        <Label htmlFor="p-phone">Mobile <span className="text-gray-400 font-normal">(only shared with buyers of your items)</span></Label>
        <Input id="p-phone" className="mt-1" inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} aria-invalid={Boolean(phoneBad)} />
        {phoneBad && <p className="text-xs text-red-600 mt-1" role="alert">Enter a 10-digit mobile number</p>}
      </div>
      <div><Label htmlFor="p-city">City</Label><Input id="p-city" className="mt-1" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
      <div><Label htmlFor="p-bio">About you</Label><Textarea id="p-bio" className="mt-1" rows={3} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="A line buyers will see on your listings" /></div>
      <Button type="submit" disabled={busy} className="bg-green-600 hover:bg-green-700">{busy ? "Saving…" : "Save changes"}</Button>
      <p className="text-xs text-gray-500 flex items-center gap-1"><Gift className="h-3 w-3" />Your email and phone are never shown publicly.</p>
    </form>
  );
}
