import { Link } from "react-router-dom";
import { Leaf, Mail } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import { formatNumber } from "@/lib/format";
import type { ImpactStats } from "@/lib/types";

export function Footer() {
  const { data } = useAsync(async () => {
    const { data, error } = await supabase.from("v_impact_stats").select("*").single();
    if (error) throw error;
    return data as ImpactStats;
  }, []);

  const col = "space-y-2 text-gray-300";
  const link = "hover:text-green-400 transition-colors";

  return (
    <footer className="bg-gray-800 text-white pt-12 pb-8 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="h-7 w-7 text-green-400" aria-hidden />
              <span className="text-xl font-semibold">EcoThreads</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Building a sustainable fashion community through buying, selling and donating pre-loved clothing.
            </p>
            <a href="mailto:hello@ecothreads.example" className="inline-flex items-center gap-2 text-sm text-gray-300 mt-4 hover:text-green-400">
              <Mail className="h-4 w-4" aria-hidden />hello@ecothreads.example
            </a>
          </div>
          <div>
            <h2 className="font-semibold mb-3">Shop</h2>
            <ul className={col}>
              <li><Link className={link} to="/shop?category=mens">Men's Fashion</Link></li>
              <li><Link className={link} to="/shop?category=womens">Women's Fashion</Link></li>
              <li><Link className={link} to="/shop?category=kids">Kids' Clothing</Link></li>
              <li><Link className={link} to="/shop?category=accessories">Accessories</Link></li>
              <li><Link className={link} to="/shop?sort=newest">New arrivals</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-3">Sell &amp; Donate</h2>
            <ul className={col}>
              <li><Link className={link} to="/sell">List an item</Link></li>
              <li><Link className={link} to="/sell?mode=donate">Donate to an NGO</Link></li>
              <li><Link className={link} to="/shop?type=donate">Free items</Link></li>
              <li><Link className={link} to="/help#selling">Pricing guide</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-3">Support</h2>
            <ul className={col}>
              <li><Link className={link} to="/help">Help centre</Link></li>
              <li><Link className={link} to="/help#safety">Safety tips</Link></li>
              <li><Link className={link} to="/help#accessibility">Accessibility</Link></li>
              <li><Link className={link} to="/impact">Our impact</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-300">
          <p>© {new Date().getFullYear()} EcoThreads. Making fashion sustainable, one thread at a time.</p>
          {data && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full" aria-hidden />
              {formatNumber(data.items_rehomed)} items re-homed · {formatNumber(data.co2_saved_kg)} kg CO₂ saved
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
