import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase, friendlyError } from "./supabase";
import type { Profile } from "./types";

type TextSize = "normal" | "large" | "xlarge";

interface AppState {
  session: Session | null;
  profile: Profile | null;
  loadingAuth: boolean;
  cartIds: Set<string>;
  wishIds: Set<string>;
  authOpen: boolean;
  authReason: string | null;
  openAuth: (reason?: string) => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  addToCart: (itemId: string, title: string) => Promise<void>;
  removeFromCart: (itemId: string, title: string) => Promise<void>;
  toggleWishlist: (itemId: string, title: string) => Promise<void>;
  reloadLists: () => Promise<void>;
  textSize: TextSize;
  setTextSize: (s: TextSize) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [wishIds, setWishIds] = useState<Set<string>>(new Set());
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    try { return (localStorage.getItem("ecothreads:text") as TextSize) || "normal"; } catch { return "normal"; }
  });

  const setTextSize = (s: TextSize) => {
    setTextSizeState(s);
    try { localStorage.setItem("ecothreads:text", s); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (textSize === "normal") document.documentElement.removeAttribute("data-text");
    else document.documentElement.setAttribute("data-text", textSize);
  }, [textSize]);

  // ---- Auth ---------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    }).catch(() => setLoadingAuth(false));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); return; }
    // the profile row is created by a database trigger right after sign-up
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await supabase.from("profiles").select("*").eq("auth_id", session.user.id).maybeSingle();
      if (data) { setProfile(data as Profile); return; }
      await new Promise((r) => setTimeout(r, 600));
    }
  }, [session]);

  const reloadLists = useCallback(async () => {
    if (!profile) { setCartIds(new Set()); setWishIds(new Set()); return; }
    const [c, w] = await Promise.all([
      supabase.from("cart_items").select("item_id").eq("profile_id", profile.id),
      supabase.from("wishlists").select("item_id").eq("profile_id", profile.id),
    ]);
    setCartIds(new Set((c.data ?? []).map((r: { item_id: string }) => r.item_id)));
    setWishIds(new Set((w.data ?? []).map((r: { item_id: string }) => r.item_id)));
  }, [profile]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);
  useEffect(() => { reloadLists(); }, [reloadLists]);

  const openAuth = (reason?: string) => { setAuthReason(reason ?? null); setAuthOpen(true); };
  const closeAuth = () => setAuthOpen(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    toast.success("You've been signed out");
  };

  // ---- Cart & wishlist (every action can be undone) -----------------------
  const addToCart = async (itemId: string, title: string) => {
    if (!profile) return openAuth("Sign in to add items to your cart");
    if (cartIds.has(itemId)) { toast.info(`"${title}" is already in your cart`); return; }
    setCartIds((s) => new Set(s).add(itemId));
    const { error } = await supabase.from("cart_items").insert({ profile_id: profile.id, item_id: itemId });
    if (error) {
      setCartIds((s) => { const n = new Set(s); n.delete(itemId); return n; });
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Added "${title}" to cart`, {
      action: { label: "Undo", onClick: () => removeFromCart(itemId, title, true) },
    });
  };

  const removeFromCart = async (itemId: string, title: string, silent = false) => {
    if (!profile) return;
    setCartIds((s) => { const n = new Set(s); n.delete(itemId); return n; });
    const { error } = await supabase.from("cart_items").delete().eq("profile_id", profile.id).eq("item_id", itemId);
    if (error) { toast.error(friendlyError(error)); reloadLists(); return; }
    if (!silent) {
      toast(`Removed "${title}" from cart`, {
        action: { label: "Undo", onClick: () => addToCart(itemId, title) },
      });
    }
  };

  const toggleWishlist = async (itemId: string, title: string) => {
    if (!profile) return openAuth("Sign in to save items to your wishlist");
    const saved = wishIds.has(itemId);
    setWishIds((s) => { const n = new Set(s); saved ? n.delete(itemId) : n.add(itemId); return n; });
    const { error } = saved
      ? await supabase.from("wishlists").delete().eq("profile_id", profile.id).eq("item_id", itemId)
      : await supabase.from("wishlists").insert({ profile_id: profile.id, item_id: itemId });
    if (error) { toast.error(friendlyError(error)); reloadLists(); return; }
    toast(saved ? `Removed "${title}" from wishlist` : `Saved "${title}" to wishlist`, {
      action: { label: "Undo", onClick: () => toggleWishlistRaw(itemId, saved) },
    });
  };

  // used by Undo: put the wishlist back exactly as it was
  const toggleWishlistRaw = async (itemId: string, shouldBeSaved: boolean) => {
    if (!profile) return;
    if (shouldBeSaved) await supabase.from("wishlists").insert({ profile_id: profile.id, item_id: itemId });
    else await supabase.from("wishlists").delete().eq("profile_id", profile.id).eq("item_id", itemId);
    reloadLists();
  };

  const value = useMemo<AppState>(() => ({
    session, profile, loadingAuth, cartIds, wishIds, authOpen, authReason,
    openAuth, closeAuth, signOut, refreshProfile, addToCart, removeFromCart, toggleWishlist, reloadLists,
    textSize, setTextSize,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [session, profile, loadingAuth, cartIds, wishIds, authOpen, authReason, textSize, refreshProfile, reloadLists]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
