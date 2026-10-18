import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Trash2, Truck, Lock, AlertTriangle, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Breadcrumbs, EmptyState, ErrorState, SafeImage } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { formatINR, formatNumber, FREE_SHIPPING_AT, SHIPPING_FEE } from "@/lib/format";
import type { ItemFull } from "@/lib/types";

export function SignInPrompt({ what }: { what: string }) {
  const { openAuth } = useApp();
  return (
    <EmptyState icon={<Lock className="h-8 w-8" />} title={`Sign in to see your ${what}`} text="Your cart, wishlist and orders are saved to your account so you can pick up on any device."
      action={<Button onClick={() => openAuth()} className="bg-green-600 hover:bg-green-700">Sign in or create account</Button>} />
  );
}

export default function Cart() {
  const { profile, cartIds, removeFromCart, loadingAuth } = useApp();
  const navigate = useNavigate();
  const ids = Array.from(cartIds);

  const { data: items, loading, error, reload } = useAsync(async () => {
    if (!ids.length) return [] as ItemFull[];
    const { data, error } = await supabase.from("v_items_full").select("*").in("id", ids);
    if (error) throw error;
    return data as ItemFull[];
  }, [ids.sort().join(",")]);

  if (loadingAuth) return null;
  if (!profile) return <div className="container mx-auto px-4 py-8"><SignInPrompt what="cart" /></div>;

  const list = (items ?? []).filter((i) => cartIds.has(i.id));
  const unavailable = list.filter((i) => i.status !== "active");
  const buyable = list.filter((i) => i.status === "active");
  const subtotal = buyable.reduce((s, i) => s + Number(i.price), 0);
  const shipping = subtotal >= FREE_SHIPPING_AT || subtotal === 0 ? 0 : SHIPPING_FEE;
  const co2 = buyable.reduce((s, i) => s + Number(i.weight_kg) * 15, 0);
  const toFree = Math.max(0, FREE_SHIPPING_AT - subtotal);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Your cart</h1>

      {error ? <ErrorState message={error} onRetry={reload} />
        : loading ? <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        : list.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title="Your cart is empty" text="Browse pre-loved pieces and add the ones you love."
            action={<Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/shop">Start shopping</Link></Button>} />
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <ul className="lg:col-span-2 space-y-3">
              {unavailable.length > 0 && (
                <li className="flex gap-2 items-start bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-sm" role="alert">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {unavailable.length === 1 ? "One item" : `${unavailable.length} items`} in your cart sold to someone else. Remove {unavailable.length === 1 ? "it" : "them"} to check out.
                </li>
              )}
              {list.map((it) => (
                <li key={it.id} className={`flex gap-4 border rounded-xl p-3 bg-white ${it.status !== "active" ? "opacity-60" : ""}`}>
                  <Link to={`/item/${it.id}`} className="shrink-0"><SafeImage src={it.cover_image} alt={it.title} className="h-24 w-24 rounded-lg object-cover" /></Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/item/${it.id}`} className="font-medium text-gray-800 hover:text-green-700">{it.title}</Link>
                    <p className="text-sm text-gray-500">{[it.size && `Size ${it.size}`, it.condition, `Seller: ${it.seller_name}`].filter(Boolean).join(" · ")}</p>
                    {it.status !== "active" && <p className="text-sm text-red-600 mt-1">No longer available</p>}
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <span className="font-semibold text-gray-800">{formatINR(it.price)}</span>
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600 gap-1" onClick={() => removeFromCart(it.id, it.title)} aria-label={`Remove ${it.title}`}>
                      <Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Remove</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="border rounded-xl p-5 h-fit bg-gray-50 space-y-4" aria-label="Order summary">
              <h2 className="font-semibold text-lg">Order summary</h2>
              {toFree > 0 && subtotal > 0 ? (
                <div>
                  <p className="text-sm text-gray-700 flex items-center gap-2"><Truck className="h-4 w-4 text-green-600" />Add {formatINR(toFree)} more for free shipping</p>
                  <Progress value={(subtotal / FREE_SHIPPING_AT) * 100} className="mt-2" aria-label="Progress to free shipping" />
                </div>
              ) : subtotal > 0 && <p className="text-sm text-green-700 flex items-center gap-2"><Truck className="h-4 w-4" />You've unlocked free shipping!</p>}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt>Items ({buyable.length})</dt><dd>{formatINR(subtotal)}</dd></div>
                <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping ? formatINR(shipping) : "Free"}</dd></div>
                <div className="flex justify-between font-semibold text-base border-t pt-2"><dt>Total</dt><dd>{formatINR(subtotal + shipping)}</dd></div>
              </dl>
              <p className="text-xs text-green-800 bg-green-50 rounded-md p-2 flex gap-2"><Leaf className="h-4 w-4 shrink-0" />Buying these pre-loved saves about {formatNumber(co2)} kg of CO₂.</p>
              <Button className="w-full h-11 bg-green-600 hover:bg-green-700" disabled={!buyable.length || unavailable.length > 0} onClick={() => navigate("/checkout")}>
                <Lock className="h-4 w-4 mr-2" />Proceed to checkout
              </Button>
              <Button asChild variant="ghost" className="w-full"><Link to="/shop">Continue shopping</Link></Button>
            </aside>
          </div>
        )}
    </div>
  );
}
