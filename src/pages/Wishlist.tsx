import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/ItemCard";
import { Breadcrumbs, EmptyState, ErrorState, GridSkeleton } from "@/components/common";
import { SignInPrompt } from "./Cart";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import type { ItemFull } from "@/lib/types";

export default function Wishlist() {
  const { profile, wishIds, loadingAuth } = useApp();
  const ids = Array.from(wishIds);
  const { data, loading, error, reload } = useAsync(async () => {
    if (!ids.length) return [] as ItemFull[];
    const { data, error } = await supabase.from("v_items_full").select("*").in("id", ids);
    if (error) throw error;
    return data as ItemFull[];
  }, [ids.sort().join(",")]);

  if (loadingAuth) return null;
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Wishlist" }]} />
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Your wishlist</h1>
      {!profile ? <SignInPrompt what="wishlist" />
        : error ? <ErrorState message={error} onRetry={reload} />
        : loading ? <GridSkeleton count={4} />
        : !data?.filter((i) => wishIds.has(i.id)).length ? (
          <EmptyState icon={<Heart className="h-8 w-8" />} title="No saved items yet" text="Tap the heart on any item to save it here for later."
            action={<Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/shop">Explore items</Link></Button>} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {data.filter((i) => wishIds.has(i.id)).map((it) => <ItemCard key={it.id} item={it} />)}
          </div>
        )}
    </div>
  );
}
