import { useState } from "react";
import { Eye, EyeOff, Lock, LogIn, Mail, MapPin, User, UserPlus, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { supabase, friendlyError } from "@/lib/supabase";
import { useApp } from "@/lib/store";

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return <p id={id} className="text-xs text-red-600 mt-1" role="alert">{msg}</p>;
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0–4
}

export function AuthModal() {
  const { authOpen, closeAuth, authReason, refreshProfile } = useApp();
  const [tab, setTab] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [si, setSi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({ name: "", email: "", city: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  // Live (inline) validation — errors appear as soon as a field is left
  const suErr = {
    name: su.name.trim().length < 2 ? "Please enter your name" : undefined,
    email: !emailOk(su.email) ? "Enter a valid email, e.g. name@gmail.com" : undefined,
    password: su.password.length < 6 ? "Use at least 6 characters" : undefined,
    confirm: su.confirm !== su.password ? "Passwords don't match" : undefined,
  };
  const siErr = {
    email: !emailOk(si.email) ? "Enter a valid email" : undefined,
    password: !si.password ? "Enter your password" : undefined,
  };

  const reset = () => {
    setSi({ email: "", password: "" });
    setSu({ name: "", email: "", city: "", password: "", confirm: "" });
    setTouched({}); setNotice(null); setShowPw(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ siEmail: true, siPassword: true });
    if (siErr.email || siErr.password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: si.email.trim(), password: si.password });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Welcome back! You're signed in.");
    reset(); closeAuth();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (Object.values(suErr).some(Boolean)) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: su.email.trim(),
      password: su.password,
      options: { data: { full_name: su.name.trim() } },
    });
    if (error) { setBusy(false); toast.error(friendlyError(error)); return; }

    if (data.session) {
      // signed in straight away — save the optional city on the profile
      if (su.city.trim()) {
        await new Promise((r) => setTimeout(r, 400));
        await supabase.from("profiles").update({ city: su.city.trim() }).eq("auth_id", data.session.user.id);
      }
      await refreshProfile();
      setBusy(false);
      toast.success(`Welcome to EcoThreads, ${su.name.split(" ")[0]}! 🌱`);
      reset(); closeAuth();
    } else {
      setBusy(false);
      setNotice(`We've sent a confirmation link to ${su.email}. Click it, then sign in here.`);
      setSi({ email: su.email, password: "" });
      setTab("signin");
    }
  };

  const pwStrength = strength(su.password);
  const pwLabel = ["Too short", "Weak", "Okay", "Good", "Strong"][pwStrength];
  const pwColor = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500", "bg-green-600"][pwStrength];

  const pwToggle = (
    <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-800" aria-label={showPw ? "Hide password" : "Show password"}>
      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <Dialog open={authOpen} onOpenChange={(o) => { if (!o) { closeAuth(); setNotice(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to EcoThreads</DialogTitle>
          <DialogDescription>{authReason ?? "Join our sustainable fashion community"}</DialogDescription>
        </DialogHeader>

        {notice && (
          <div className="flex gap-2 text-sm bg-blue-50 text-blue-800 border border-blue-200 rounded-md p-3" role="status">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />{notice}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" className="gap-2"><LogIn className="h-4 w-4" />Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="gap-2"><UserPlus className="h-4 w-4" />Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 pt-2" noValidate>
              <div>
                <Label htmlFor="si-email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="si-email" type="email" autoComplete="email" placeholder="you@email.com" className="pl-10"
                    value={si.email} onChange={(e) => setSi({ ...si, email: e.target.value })} onBlur={() => touch("siEmail")}
                    aria-invalid={Boolean(touched.siEmail && siErr.email)} aria-describedby="si-email-err" />
                </div>
                <FieldError id="si-email-err" msg={touched.siEmail ? siErr.email : undefined} />
              </div>
              <div>
                <Label htmlFor="si-pw">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="si-pw" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="Your password" className="pl-10 pr-10"
                    value={si.password} onChange={(e) => setSi({ ...si, password: e.target.value })} onBlur={() => touch("siPassword")}
                    aria-invalid={Boolean(touched.siPassword && siErr.password)} aria-describedby="si-pw-err" />
                  {pwToggle}
                </div>
                <FieldError id="si-pw-err" msg={touched.siPassword ? siErr.password : undefined} />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-green-600 hover:bg-green-700">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-sm text-center text-gray-600">
                New here? <button type="button" className="text-green-700 underline" onClick={() => setTab("signup")}>Create an account</button>
              </p>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3 pt-2" noValidate>
              <div>
                <Label htmlFor="su-name">Full name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="su-name" autoComplete="name" placeholder="Your full name" className="pl-10"
                    value={su.name} onChange={(e) => setSu({ ...su, name: e.target.value })} onBlur={() => touch("name")}
                    aria-invalid={Boolean(touched.name && suErr.name)} aria-describedby="su-name-err" />
                </div>
                <FieldError id="su-name-err" msg={touched.name ? suErr.name : undefined} />
              </div>
              <div>
                <Label htmlFor="su-email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="su-email" type="email" autoComplete="email" placeholder="you@email.com" className="pl-10"
                    value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} onBlur={() => touch("email")}
                    aria-invalid={Boolean(touched.email && suErr.email)} aria-describedby="su-email-err" />
                </div>
                <FieldError id="su-email-err" msg={touched.email ? suErr.email : undefined} />
              </div>
              <div>
                <Label htmlFor="su-city">City <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="su-city" autoComplete="address-level2" placeholder="e.g. Mumbai" className="pl-10"
                    value={su.city} onChange={(e) => setSu({ ...su, city: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="su-pw">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="su-pw" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="At least 6 characters" className="pl-10 pr-10"
                    value={su.password} onChange={(e) => setSu({ ...su, password: e.target.value })} onBlur={() => touch("password")}
                    aria-invalid={Boolean(touched.password && suErr.password)} aria-describedby="su-pw-err su-pw-strength" />
                  {pwToggle}
                </div>
                {su.password && (
                  <div className="mt-1.5 flex items-center gap-2" id="su-pw-strength">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded"><div className={`h-1.5 rounded ${pwColor}`} style={{ width: `${Math.max(1, pwStrength) * 25}%` }} /></div>
                    <span className="text-xs text-gray-600">{pwLabel}</span>
                  </div>
                )}
                <FieldError id="su-pw-err" msg={touched.password ? suErr.password : undefined} />
              </div>
              <div>
                <Label htmlFor="su-confirm">Confirm password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input id="su-confirm" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Type it again" className="pl-10"
                    value={su.confirm} onChange={(e) => setSu({ ...su, confirm: e.target.value })} onBlur={() => touch("confirm")}
                    aria-invalid={Boolean(touched.confirm && suErr.confirm)} aria-describedby="su-confirm-err" />
                </div>
                <FieldError id="su-confirm-err" msg={touched.confirm ? suErr.confirm : undefined} />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-green-600 hover:bg-green-700">
                {busy ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
