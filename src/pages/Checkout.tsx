import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CreditCard, Smartphone, Landmark, Wallet, Banknote, Lock, Pencil, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs, EmptyState, SafeImage } from "@/components/common";
import { SignInPrompt } from "./Cart";
import { useAsync } from "@/hooks/useAsync";
import { supabase, friendlyError } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { formatINR, FREE_SHIPPING_AT, SHIPPING_FEE } from "@/lib/format";
import type { ItemFull, Order } from "@/lib/types";

const STATES = ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal","Other"];

const METHODS = [
  { id: "upi", label: "UPI", sub: "GPay, PhonePe, Paytm", icon: Smartphone },
  { id: "card", label: "Credit / Debit card", sub: "Visa, Mastercard, RuPay", icon: CreditCard },
  { id: "netbanking", label: "Net banking", sub: "All major banks", icon: Landmark },
  { id: "wallet", label: "Wallet", sub: "Paytm, Amazon Pay", icon: Wallet },
  { id: "cod", label: "Cash on delivery", sub: "Pay when it arrives", icon: Banknote },
] as const;
const BANKS = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak", "Bank of Baroda"];

const STEPS = ["Delivery address", "Payment", "Review & pay"];

export default function Checkout() {
  const { profile, cartIds, reloadLists, loadingAuth } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [addr, setAddr] = useState({ name: "", phone: "", address: "", city: "", state: "", pincode: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<string>("upi");
  const [upi, setUpi] = useState("");
  const [bank, setBank] = useState("");
  const [paying, setPaying] = useState(false);
  const ids = Array.from(cartIds);

  const { data: items } = useAsync(async () => {
    if (!ids.length) return [] as ItemFull[];
    const { data, error } = await supabase.from("v_items_full").select("*").in("id", ids);
    if (error) throw error;
    return data as ItemFull[];
  }, [ids.sort().join(",")]);

  // prefill from profile once (less typing)
  useEffect(() => {
    if (profile) setAddr((a) => (a.name ? a : { ...a, name: profile.full_name, phone: profile.phone ?? "", city: profile.city ?? "" }));
  }, [profile]);

  if (loadingAuth) return null;
  if (!profile) return <div className="container mx-auto px-4 py-8"><SignInPrompt what="checkout" /></div>;
  if (items && items.length === 0) {
    return <EmptyState icon={<Lock className="h-8 w-8" />} title="Nothing to check out" text="Your cart is empty."
      action={<Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/shop">Browse items</Link></Button>} />;
  }

  const subtotal = (items ?? []).reduce((s, i) => s + Number(i.price), 0);
  const shipping = subtotal >= FREE_SHIPPING_AT ? 0 : SHIPPING_FEE;

  const addrErr = {
    name: addr.name.trim().length < 2 ? "Enter the receiver's name" : undefined,
    phone: !/^[6-9]\d{9}$/.test(addr.phone.replace(/\s/g, "")) ? "Enter a 10-digit mobile number" : undefined,
    address: addr.address.trim().length < 8 ? "Enter house no., street and area" : undefined,
    city: addr.city.trim().length < 2 ? "Enter your city" : undefined,
    state: !addr.state ? "Choose your state" : undefined,
    pincode: !/^[1-9]\d{5}$/.test(addr.pincode) ? "Pincode must be 6 digits" : undefined,
  };
  const payErr =
    method === "upi" && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi) ? "Enter a UPI ID like name@okhdfc"
    : method === "netbanking" && !bank ? "Choose your bank" : undefined;

  const next = () => {
    if (step === 0) {
      setTouched({ name: true, phone: true, address: true, city: true, state: true, pincode: true });
      if (Object.values(addrErr).some(Boolean)) { toast.error("Please complete the highlighted fields"); return; }
    }
    if (step === 1) {
      setTouched((t) => ({ ...t, pay: true }));
      if (payErr) { toast.error(payErr); return; }
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pay = async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, method === "cod" ? 600 : 1800)); // simulated gateway
    const { data, error } = await supabase.rpc("place_order", {
      p_payment_method: method,
      p_shipping: { ...addr, phone: addr.phone.replace(/\s/g, "") },
    });
    setPaying(false);
    if (error) { toast.error(friendlyError(error)); reloadLists(); return; }
    await reloadLists();
    const order = data as Order;
    navigate(`/order/${order.order_number}`, { state: { order } });
  };

  const field = (k: keyof typeof addr, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={`a-${k}`}>{label}</Label>
      <Input id={`a-${k}`} className={`mt-1 ${touched[k] && addrErr[k] ? "border-red-400" : ""}`} value={addr[k]}
        onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
        aria-invalid={Boolean(touched[k] && addrErr[k])} aria-describedby={`a-${k}-err`} {...props} />
      {touched[k] && addrErr[k] && <p id={`a-${k}-err`} role="alert" className="text-xs text-red-600 mt-1">{addrErr[k]}</p>}
    </div>
  );

  const methodInfo = METHODS.find((m) => m.id === method)!;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Checkout</h1>

      {/* Stepper — always shows where you are and what's left */}
      <ol className="flex items-center gap-2 mb-8" aria-label="Checkout progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1" aria-current={i === step ? "step" : undefined}>
            <span className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${i < step ? "bg-green-600 text-white" : i === step ? "bg-green-100 text-green-800 ring-2 ring-green-600" : "bg-gray-100 text-gray-500"}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm hidden sm:inline ${i === step ? "font-semibold text-gray-800" : "text-gray-500"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 ${i < step ? "bg-green-600" : "bg-gray-200"}`} />}
          </li>
        ))}
      </ol>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 border rounded-xl p-6 bg-white">
          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <h2 className="sm:col-span-2 text-lg font-semibold">Where should we deliver?</h2>
              {field("name", "Full name", { autoComplete: "name" })}
              {field("phone", "Mobile number", { autoComplete: "tel", inputMode: "numeric", placeholder: "98XXXXXXXX", maxLength: 10 })}
              <div className="sm:col-span-2">{field("address", "House no., street, area", { autoComplete: "street-address" })}</div>
              {field("city", "City", { autoComplete: "address-level2" })}
              <div>
                <Label htmlFor="a-state">State</Label>
                <select id="a-state" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, state: true }))}
                  className={`mt-1 w-full border rounded-md px-3 h-9 bg-white text-sm ${touched.state && addrErr.state ? "border-red-400" : ""}`} aria-invalid={Boolean(touched.state && addrErr.state)}>
                  <option value="">Select state</option>{STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {touched.state && addrErr.state && <p role="alert" className="text-xs text-red-600 mt-1">{addrErr.state}</p>}
              </div>
              {field("pincode", "Pincode", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6, placeholder: "400001" })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">How would you like to pay?</h2>
              <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
                {METHODS.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}
                    className={`flex items-center gap-3 border-2 rounded-lg p-3 text-left ${method === m.id ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <m.icon className="h-5 w-5 text-green-700" /><span><span className="block font-medium">{m.label}</span><span className="text-xs text-gray-500">{m.sub}</span></span>
                  </button>
                ))}
              </div>
              {method === "upi" && (
                <div>
                  <Label htmlFor="upi">UPI ID</Label>
                  <Input id="upi" className="mt-1" placeholder="yourname@okhdfc" value={upi} onChange={(e) => setUpi(e.target.value.trim())} aria-invalid={Boolean(touched.pay && payErr)} />
                  {touched.pay && payErr && <p role="alert" className="text-xs text-red-600 mt-1">{payErr}</p>}
                </div>
              )}
              {method === "netbanking" && (
                <div>
                  <Label htmlFor="bank">Bank</Label>
                  <select id="bank" value={bank} onChange={(e) => setBank(e.target.value)} className="mt-1 w-full border rounded-md px-3 h-9 bg-white text-sm">
                    <option value="">Choose your bank</option>{BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              )}
              {method === "card" && <p className="text-sm text-gray-600">You'll enter card details on the bank's secure page. EcoThreads never sees or stores your card number.</p>}
              <p className="text-xs text-gray-500 flex gap-2 items-start bg-gray-50 rounded-md p-3"><ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                Demo checkout: payment is simulated and no money is charged. Payment details are not saved.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Check everything before you pay</h2>
              <div className="flex justify-between gap-4 border rounded-lg p-4">
                <div className="text-sm"><p className="font-medium">Delivering to {addr.name}</p><p className="text-gray-600">{addr.address}, {addr.city}, {addr.state} – {addr.pincode}</p><p className="text-gray-600">📞 {addr.phone}</p></div>
                <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="gap-1"><Pencil className="h-3.5 w-3.5" />Change</Button>
              </div>
              <div className="flex justify-between gap-4 border rounded-lg p-4">
                <div className="text-sm"><p className="font-medium">Paying with {methodInfo.label}</p><p className="text-gray-600">{method === "upi" ? upi : method === "netbanking" ? bank : methodInfo.sub}</p></div>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1"><Pencil className="h-3.5 w-3.5" />Change</Button>
              </div>
              <ul className="divide-y border rounded-lg">
                {(items ?? []).map((it) => (
                  <li key={it.id} className="flex items-center gap-3 p-3">
                    <SafeImage src={it.cover_image} alt="" className="h-14 w-14 rounded object-cover" />
                    <span className="flex-1 text-sm">{it.title}<span className="block text-gray-500 text-xs">{it.condition}{it.size ? ` · Size ${it.size}` : ""}</span></span>
                    <span className="text-sm font-medium">{formatINR(it.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between mt-8">
            {step > 0 ? <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-1" disabled={paying}><ChevronLeft className="h-4 w-4" />Back</Button>
              : <Button asChild variant="ghost"><Link to="/cart"><ChevronLeft className="h-4 w-4" />Back to cart</Link></Button>}
            {step < 2 ? <Button onClick={next} className="bg-green-600 hover:bg-green-700">Continue</Button>
              : <Button onClick={pay} disabled={paying} className="bg-green-600 hover:bg-green-700 min-w-44 gap-2">
                  {paying ? <><Loader2 className="h-4 w-4 animate-spin" />{method === "cod" ? "Placing order…" : "Processing payment…"}</> : <><Lock className="h-4 w-4" />{method === "cod" ? "Place order" : `Pay ${formatINR(subtotal + shipping)}`}</>}
                </Button>}
          </div>
        </section>

        <aside className="border rounded-xl p-5 h-fit bg-gray-50" aria-label="Order summary">
          <h2 className="font-semibold mb-3">Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Items ({items?.length ?? 0})</dt><dd>{formatINR(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping ? formatINR(shipping) : "Free"}</dd></div>
            <div className="flex justify-between font-semibold text-base border-t pt-2"><dt>Total</dt><dd>{formatINR(subtotal + shipping)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
