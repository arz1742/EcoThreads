import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Heart, ShoppingBag, User, Leaf, LogOut, Mic, MicOff, Menu, LayoutDashboard, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { useApp } from "@/lib/store";
import { useVoice } from "@/hooks/useVoice";

const NAV = [
  { to: "/shop", label: "Shop" },
  { to: "/sell", label: "Sell" },
  { to: "/sell?mode=donate", label: "Donate" },
  { to: "/impact", label: "Our Impact" },
  { to: "/help", label: "Help" },
];

const SIZE_LABEL = { normal: "Normal text", large: "Large text", xlarge: "Extra large text" } as const;

export function Header() {
  const { profile, cartIds, wishIds, openAuth, signOut, textSize, setTextSize } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const runSearch = (text: string) => {
    const term = text.trim();
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
    setMenuOpen(false);
  };

  const voice = useVoice((text) => {
    setQ(text);
    toast.success(`Searching for "${text}"`);
    runSearch(text);
  });

  const onMic = () => {
    if (voice.listening) return voice.stop();
    if (!voice.start()) toast.info("Voice search works in Chrome and Edge. Please type your search instead.");
    else toast("Listening… say something like “denim jacket”", { duration: 2500 });
  };

  // Press "/" anywhere to jump to search (keyboard shortcut for frequent users)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cycleText = () => {
    const next = textSize === "normal" ? "large" : textSize === "large" ? "xlarge" : "normal";
    setTextSize(next);
    toast(SIZE_LABEL[next], { duration: 1500 });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-1 py-1 transition-colors border-b-2 ${isActive ? "text-green-700 border-green-600" : "text-gray-700 border-transparent hover:text-green-600"}`;

  const searchBox = (
    <form role="search" onSubmit={(e) => { e.preventDefault(); runSearch(q); }} className="relative w-full">
      <label htmlFor="site-search" className="sr-only">Search for clothes</label>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden />
      <input
        id="site-search"
        ref={searchRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for clothes…  ( / )"
        className="pl-10 pr-11 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 w-full bg-white"
      />
      <button
        type="button"
        onClick={onMic}
        aria-label={voice.listening ? "Stop voice search" : "Search by voice"}
        aria-pressed={voice.listening}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center ${voice.listening ? "bg-red-500 text-white animate-pulse" : "text-gray-500 hover:bg-green-50 hover:text-green-700"}`}
      >
        {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
    </form>
  );

  return (
    <header className="bg-white/95 backdrop-blur shadow-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader><SheetTitle className="flex items-center gap-2"><Leaf className="h-5 w-5 text-green-600" />EcoThreads</SheetTitle></SheetHeader>
            <div className="px-4 space-y-4">
              {searchBox}
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {NAV.map((n) => (
                  <Link key={n.label} to={n.to} onClick={() => setMenuOpen(false)} className="py-2 px-2 rounded-md hover:bg-green-50 text-gray-800">{n.label}</Link>
                ))}
                <Link to="/wishlist" onClick={() => setMenuOpen(false)} className="py-2 px-2 rounded-md hover:bg-green-50 text-gray-800">Wishlist</Link>
                <Link to="/account" onClick={() => setMenuOpen(false)} className="py-2 px-2 rounded-md hover:bg-green-50 text-gray-800">My account</Link>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="EcoThreads home">
          <Leaf className="h-7 w-7 text-green-600" aria-hidden />
          <span className="text-xl md:text-2xl font-semibold text-gray-800">EcoThreads</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-5 ml-4" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.label} to={n.to} end className={navClass}>{n.label}</NavLink>
          ))}
        </nav>

        <div className="hidden md:block flex-1 max-w-sm ml-auto">{searchBox}</div>

        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <Button variant="ghost" size="icon" onClick={cycleText} aria-label={`Text size: ${SIZE_LABEL[textSize]}. Click to change`} title="Change text size">
            <Type className="h-5 w-5" />
            {textSize !== "normal" && <span className="sr-only">{SIZE_LABEL[textSize]}</span>}
          </Button>

          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to="/wishlist" aria-label={`Wishlist, ${wishIds.size} items`}>
              <Heart className="h-5 w-5" />
              {wishIds.size > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{wishIds.size}</span>}
            </Link>
          </Button>

          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to="/cart" aria-label={`Cart, ${cartIds.size} items`}>
              <ShoppingBag className="h-5 w-5" />
              {cartIds.size > 0 && <span className="absolute -top-0.5 -right-0.5 bg-green-600 text-white text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{cartIds.size}</span>}
            </Link>
          </Button>

          {profile ? (
            <div className="relative">
              <Button variant="ghost" className="gap-2 px-2" onClick={() => setAccountOpen((o) => !o)} aria-haspopup="menu" aria-expanded={accountOpen}>
                <span className="h-8 w-8 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold">
                  {profile.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="hidden xl:inline text-sm text-gray-700">Hi, {profile.full_name.split(" ")[0]}</span>
              </Button>
              {accountOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-52 bg-white border rounded-lg shadow-lg py-1 z-50" onMouseLeave={() => setAccountOpen(false)}>
                  <Link role="menuitem" to="/account" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-green-50"><LayoutDashboard className="h-4 w-4" />My dashboard</Link>
                  <Link role="menuitem" to="/impact" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-green-50"><Leaf className="h-4 w-4" />Our impact</Link>
                  <button role="menuitem" onClick={() => { setAccountOpen(false); signOut(); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-red-50 text-red-600"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <Button onClick={() => openAuth()} className="bg-green-600 hover:bg-green-700 gap-2 ml-1" size="sm">
              <User className="h-4 w-4" /><span className="hidden sm:inline">Sign in</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
