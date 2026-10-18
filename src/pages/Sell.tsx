import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Camera, Heart, IndianRupee, Upload, X, CheckCircle2, Lightbulb, Info, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/common";
import { supabase, friendlyError } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { CONDITIONS, conditionStyle, formatINR } from "@/lib/format";
import type { Category, Ngo } from "@/lib/types";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const WEIGHT_BY_CATEGORY: Record<string, number> = { mens: 0.6, womens: 0.5, kids: 0.3, accessories: 0.4 };

type Mode = "sell" | "donate";
interface Photo { file: File; url: string }

const empty = { title: "", category: "", brand: "", size: "", color: "", condition: "", price: "", ngo: "", description: "" };

export default function Sell() {
  const [params, setParams] = useSearchParams();
  const { profile, openAuth } = useApp();
  const mode: Mode = params.get("mode") === "donate" ? "donate" : "sell";
  const setMode = (m: Mode) => setParams(m === "donate" ? { mode: "donate" } : {}, { replace: true });

  const [form, setForm] = useState(empty);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState<{ id: string; title: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [priceHint, setPriceHint] = useState<{ min: number; max: number; avg: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order").then(({ data }) => setCategories((data as Category[]) ?? []));
    supabase.from("ngos").select("*").eq("is_active", true).order("name").then(({ data }) => setNgos((data as Ngo[]) ?? []));
  }, []);

  // Pricing guide: what similar items in this category are listed for
  useEffect(() => {
    const cat = categories.find((c) => c.slug === form.category);
    if (!cat || mode === "donate") { setPriceHint(null); return; }
    supabase.from("items").select("price").eq("category_id", cat.id).eq("listing_type", "sell").then(({ data }) => {
      const prices = (data ?? []).map((r: { price: number }) => Number(r.price)).filter((p) => p > 0);
      if (!prices.length) { setPriceHint(null); return; }
      setPriceHint({ min: Math.min(...prices), max: Math.max(...prices), avg: prices.reduce((a, b) => a + b, 0) / prices.length });
    });
  }, [form.category, categories, mode]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const errors = useMemo(() => ({
    title: form.title.trim().length < 3 ? "Give your item a title (at least 3 letters)" : undefined,
    category: !form.category ? "Choose a category" : undefined,
    condition: !form.condition ? "Choose the condition" : undefined,
    price: mode === "sell" && (!form.price || Number(form.price) <= 0) ? "Enter a price above ₹0"
      : mode === "sell" && Number(form.price) > 100000 ? "That seems too high — please check the price" : undefined,
  }), [form, mode]);
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : undefined);

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const rejected = Array.from(list).length - incoming.length;
    if (rejected) toast.error("Only image files (JPG, PNG, WEBP) can be added");
    const tooBig = incoming.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) toast.error(`${tooBig[0].name} is larger than 10 MB`);
    const ok = incoming.filter((f) => f.size <= MAX_BYTES);
    const room = MAX_FILES - photos.length;
    if (ok.length > room) toast.error(`You can add up to ${MAX_FILES} photos. ${room > 0 ? `Added the first ${room}.` : ""}`);
    setPhotos((p) => [...p, ...ok.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removePhoto = (i: number) => setPhotos((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, j) => j !== i); });
  const makeCover = (i: number) => setPhotos((p) => [p[i], ...p.filter((_, j) => j !== i)]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, category: true, condition: true, price: true });
    if (Object.values(errors).some(Boolean)) {
      toast.error("Please fix the highlighted fields");
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    if (!profile) return openAuth("Sign in to publish your listing — your details are kept");

    const cat = categories.find((c) => c.slug === form.category)!;
    setBusy(true);
    let itemId: string | null = null;
    try {
      setProgress("Saving details…");
      const { data: item, error } = await supabase.from("items").insert({
        seller_id: profile.id,
        category_id: cat.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        brand: form.brand.trim() || null,
        size: form.size.trim() || null,
        color: form.color.trim() || null,
        condition: form.condition,
        listing_type: mode,
        price: mode === "sell" ? Number(form.price) : 0,
        ngo_id: mode === "donate" && form.ngo ? Number(form.ngo) : null,
        weight_kg: WEIGHT_BY_CATEGORY[cat.slug] ?? 0.5,
      }).select("id").single();
      if (error) throw error;
      itemId = item.id as string;

      const { data: auth } = await supabase.auth.getUser();
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        const f = photos[i].file;
        const path = `${auth.user!.id}/${itemId}/${i}-${Date.now()}.${(f.name.split(".").pop() || "jpg").toLowerCase()}`;
        const up = await supabase.storage.from("item-images").upload(path, f, { cacheControl: "3600", upsert: false });
        if (up.error) throw up.error;
        const url = supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl;
        const img = await supabase.from("item_images").insert({ item_id: itemId, url, alt_text: form.title.trim(), position: i });
        if (img.error) throw img.error;
      }

      toast.success(mode === "sell" ? "Your item is live! 🎉" : "Thank you for donating! 💚");
      setDone({ id: itemId, title: form.title.trim() });
      setForm(empty); setTouched({}); setPhotos([]);
    } catch (err) {
      if (itemId) await supabase.from("items").delete().eq("id", itemId); // undo half-finished listing
      toast.error(friendlyError(err));
    } finally {
      setBusy(false); setProgress("");
    }
  };

  if (done) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center">
        <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-3xl font-semibold text-gray-800">“{done.title}” is listed</h1>
        <p className="text-gray-600 mt-3">Buyers can see it right now. We'll show any orders or requests in your dashboard.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Button asChild className="bg-green-600 hover:bg-green-700"><Link to={`/item/${done.id}`}>View listing</Link></Button>
          <Button variant="outline" onClick={() => setDone(null)}>List another item</Button>
          <Button asChild variant="ghost"><Link to="/account">Go to dashboard</Link></Button>
        </div>
      </div>
    );
  }

  const catName = categories.find((c) => c.slug === form.category)?.name;
  const fieldCls = (k: keyof typeof errors) => (show(k) ? "border-red-400 focus-visible:ring-red-300" : "");
  const Err = ({ k }: { k: keyof typeof errors }) => show(k) ? <p id={`${k}-err`} role="alert" className="text-xs text-red-600 mt-1">{show(k)}</p> : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: mode === "sell" ? "Sell an item" : "Donate an item" }]} />
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-800">Give Your Clothes a Second Life</h1>
        <p className="text-gray-600 mt-2">Earn some money or help someone in need. Listing takes about 2 minutes.</p>
      </div>

      {!profile && (
        <div className="max-w-5xl mx-auto mb-6 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-3 text-sm">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>You can fill in the form now. We'll ask you to <button className="underline" onClick={() => openAuth()}>sign in</button> before publishing — nothing you type will be lost.</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-green-600" />List your item</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <fieldset>
              <legend className="text-sm font-medium mb-2">What would you like to do?</legend>
              <div className="grid grid-cols-2 gap-3" role="radiogroup">
                {([["sell", "Sell for money", IndianRupee, "text-green-600"], ["donate", "Donate for free", Heart, "text-rose-500"]] as const).map(([v, l, Icon, c]) => (
                  <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                    className={`flex items-center gap-2 border-2 rounded-lg p-3 text-left ${mode === v ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <Icon className={`h-5 w-5 ${c}`} /><span className="font-medium">{l}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Label htmlFor="title">Item title <span className="text-red-500" aria-hidden>*</span></Label>
                <Input id="title" className={`mt-1 ${fieldCls("title")}`} placeholder="e.g. Vintage Denim Jacket" maxLength={120}
                  value={form.title} onChange={(e) => set("title", e.target.value)} onBlur={() => touch("title")}
                  aria-invalid={Boolean(show("title"))} aria-describedby="title-err" aria-required />
                <Err k="title" />
              </div>

              <div>
                <Label htmlFor="category">Category <span className="text-red-500" aria-hidden>*</span></Label>
                <select id="category" value={form.category} onChange={(e) => set("category", e.target.value)} onBlur={() => touch("category")}
                  aria-invalid={Boolean(show("category"))} aria-describedby="category-err" aria-required
                  className={`mt-1 w-full border rounded-md px-3 h-9 bg-white text-sm ${show("category") ? "border-red-400" : ""}`}>
                  <option value="">Select a category</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <Err k="category" />
              </div>

              <div>
                <Label htmlFor="condition">Condition <span className="text-red-500" aria-hidden>*</span></Label>
                <select id="condition" value={form.condition} onChange={(e) => set("condition", e.target.value)} onBlur={() => touch("condition")}
                  aria-invalid={Boolean(show("condition"))} aria-describedby="condition-err" aria-required
                  className={`mt-1 w-full border rounded-md px-3 h-9 bg-white text-sm ${show("condition") ? "border-red-400" : ""}`}>
                  <option value="">Select condition</option>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <Err k="condition" />
              </div>

              <div><Label htmlFor="size">Size</Label><Input id="size" className="mt-1" placeholder="e.g. M, 32, UK 9" value={form.size} onChange={(e) => set("size", e.target.value)} /></div>
              <div><Label htmlFor="brand">Brand</Label><Input id="brand" className="mt-1" placeholder="Optional" value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
              <div><Label htmlFor="color">Colour</Label><Input id="color" className="mt-1" placeholder="e.g. Navy blue" value={form.color} onChange={(e) => set("color", e.target.value)} /></div>

              {mode === "sell" ? (
                <div>
                  <Label htmlFor="price">Price (₹) <span className="text-red-500" aria-hidden>*</span></Label>
                  <div className="relative mt-1">
                    <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                    <Input id="price" type="number" inputMode="numeric" min={1} className={`pl-9 ${fieldCls("price")}`} placeholder="500"
                      value={form.price} onChange={(e) => set("price", e.target.value)} onBlur={() => touch("price")}
                      aria-invalid={Boolean(show("price"))} aria-describedby="price-err price-hint" aria-required />
                  </div>
                  <Err k="price" />
                  {priceHint && (
                    <p id="price-hint" className="text-xs text-gray-600 mt-1 flex gap-1"><Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      Similar {catName} items: {formatINR(priceHint.min)} – {formatINR(priceHint.max)} (avg {formatINR(priceHint.avg)})
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <Label htmlFor="ngo">Partner NGO <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <select id="ngo" value={form.ngo} onChange={(e) => set("ngo", e.target.value)} className="mt-1 w-full border rounded-md px-3 h-9 bg-white text-sm">
                    <option value="">Let anyone request it</option>
                    {ngos.map((n) => <option key={n.id} value={n.id}>{n.name} — {n.city}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">If nobody requests it, we arrange pickup for this NGO.</p>
                </div>
              )}

              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} maxLength={1000} className="mt-1" value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Fabric, fit, how often it was worn, any marks or flaws…" />
                <p className="text-xs text-gray-500 mt-1 text-right">{form.description.length}/1000</p>
              </div>
            </div>

            <div>
              <Label>Photos <span className="text-gray-400 font-normal">(up to {MAX_FILES} — the first one is the cover)</span></Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                className={`mt-2 border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? "border-green-500 bg-green-50" : "border-gray-300"}`}
              >
                <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" aria-hidden />
                <p className="text-sm text-gray-600">Drag &amp; drop photos here, or</p>
                <Button type="button" variant="outline" className="mt-2 border-green-600 text-green-700" onClick={() => fileRef.current?.click()} disabled={photos.length >= MAX_FILES}>
                  Choose photos
                </Button>
                <p className="text-xs text-gray-400 mt-2">JPG, PNG or WEBP · up to 10 MB each · {photos.length}/{MAX_FILES} added</p>
                <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              </div>
              {photos.length > 0 && (
                <ul className="flex flex-wrap gap-3 mt-3" aria-label="Selected photos">
                  {photos.map((p, i) => (
                    <li key={p.url} className="relative h-24 w-24 rounded-lg overflow-hidden border group">
                      <img src={p.url} alt={`Selected photo ${i + 1}`} className="h-full w-full object-cover" />
                      {i === 0 ? <span className="absolute bottom-0 inset-x-0 bg-green-600 text-white text-[10px] text-center py-0.5">Cover</span>
                        : <button type="button" onClick={() => makeCover(i)} className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 flex items-center justify-center gap-1"><Star className="h-3 w-3" />Make cover</button>}
                      <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live preview — users see exactly what buyers will see */}
        <aside className="space-y-4 lg:sticky lg:top-24 self-start" aria-label="Listing preview">
          <p className="text-sm font-medium text-gray-700">Live preview</p>
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <div className="relative aspect-square bg-gray-100 flex items-center justify-center">
              {photos[0] ? <img src={photos[0].url} alt="" className="w-full h-full object-cover" /> : <Camera className="h-10 w-10 text-gray-300" />}
              {form.condition && <Badge className={`absolute top-2 left-2 ${conditionStyle[form.condition]}`}>{form.condition}</Badge>}
            </div>
            <div className="p-4">
              <div className="flex justify-between gap-2">
                <h3 className="font-semibold text-gray-800">{form.title || "Your item title"}</h3>
                <span className={mode === "donate" ? "text-rose-600 font-semibold text-sm" : "text-green-700 font-semibold"}>
                  {mode === "donate" ? "FREE" : form.price ? formatINR(Number(form.price)) : "₹ —"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{[catName, form.size && `Size ${form.size}`, form.brand].filter(Boolean).join(" · ") || "Category · Size · Brand"}</p>
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full h-12 bg-green-600 hover:bg-green-700 text-base">
            {busy ? progress || "Publishing…" : mode === "sell" ? "List for sale" : "List for donation"}
          </Button>
          <p className="text-xs text-gray-500 text-center">Fields marked <span className="text-red-500">*</span> are required. You can edit or remove the listing later.</p>
        </aside>
      </form>
    </div>
  );
}
