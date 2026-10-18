import { Link } from "react-router-dom";
import { Heart, MapPin, ShoppingBag, Gift } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { SafeImage } from "./common";
import { useApp } from "@/lib/store";
import { conditionStyle, formatINR } from "@/lib/format";
import type { ItemFull } from "@/lib/types";

export function ItemCard({ item }: { item: ItemFull }) {
  const { wishIds, cartIds, toggleWishlist, addToCart, profile } = useApp();
  const saved = wishIds.has(item.id);
  const inCart = cartIds.has(item.id);
  const isMine = profile?.id === item.seller_id;
  const unavailable = item.status !== "active";

  return (
    <article className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
      <div className="relative aspect-square overflow-hidden">
        <Link to={`/item/${item.id}`} aria-label={`View ${item.title}`} tabIndex={-1}>
          <SafeImage src={item.cover_image} alt={item.title} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${unavailable ? "grayscale opacity-70" : ""}`} />
        </Link>
        <Badge className={`absolute top-2 left-2 ${conditionStyle[item.condition] ?? ""}`}>{item.condition}</Badge>
        {unavailable && <Badge className="absolute bottom-2 left-2 bg-gray-800 text-white capitalize">{item.status}</Badge>}
        <button
          onClick={() => toggleWishlist(item.id, item.title)}
          aria-label={saved ? `Remove ${item.title} from wishlist` : `Save ${item.title} to wishlist`}
          aria-pressed={saved}
          className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:scale-110 transition"
        >
          <Heart className={`h-4 w-4 ${saved ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
        </button>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-800 leading-snug line-clamp-2">
            <Link to={`/item/${item.id}`} className="hover:text-green-700">{item.title}</Link>
          </h3>
          {item.listing_type === "donate"
            ? <span className="shrink-0 text-sm font-semibold text-rose-600">FREE</span>
            : <span className="shrink-0 font-semibold text-green-700">{formatINR(item.price)}</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          {item.size && <span className="border rounded px-1.5 py-0.5 mr-1">Size {item.size}</span>}
          {item.seller_city && <><MapPin className="h-3 w-3" aria-hidden />{item.seller_city}</>}
        </p>

        <div className="mt-auto pt-4">
          {isMine ? (
            <Button variant="outline" className="w-full" asChild><Link to="/account">Your listing</Link></Button>
          ) : item.listing_type === "donate" ? (
            <Button className="w-full bg-rose-500 hover:bg-rose-600 gap-2" disabled={unavailable} asChild={!unavailable}>
              {unavailable ? <span>Given away</span> : <Link to={`/item/${item.id}#request`}><Gift className="h-4 w-4" />Request item</Link>}
            </Button>
          ) : (
            <Button
              className={inCart ? "w-full gap-2 border-green-600" : "w-full bg-green-600 hover:bg-green-700 gap-2"}
              disabled={unavailable}
              variant={inCart ? "outline" : "default"}
              onClick={() => (inCart ? undefined : addToCart(item.id, item.title))}
              asChild={inCart}
            >
              {inCart ? <Link to="/cart" className="text-green-700"><ShoppingBag className="h-4 w-4" />In cart — view</Link>
                : <><ShoppingBag className="h-4 w-4" />{unavailable ? "Sold" : "Add to cart"}</>}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
