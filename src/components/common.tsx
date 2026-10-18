import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, ImageOff, RefreshCw, Star } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export function SafeImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`bg-gray-100 flex flex-col items-center justify-center text-gray-400 ${className ?? ""}`} role="img" aria-label={alt}>
        <ImageOff className="h-8 w-8" aria-hidden />
        <span className="text-xs mt-1">No photo</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}

export function StarRating({ rating, size = "sm", label = true }: { rating: number; size?: "sm" | "md"; label?: boolean }) {
  const cls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label ? `${rating} out of 5 stars` : undefined} role={label ? "img" : undefined}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} aria-hidden className={`${cls} ${s <= Math.round(rating) ? "text-yellow-400 fill-current" : "text-gray-300"}`} />
      ))}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {it.to ? <Link to={it.to} className="hover:text-green-700 hover:underline">{it.label}</Link> : <span aria-current="page" className="text-gray-800">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-4">
      <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">{icon}</div>
      <h2 className="text-xl text-gray-800 font-semibold mb-2">{title}</h2>
      <p className="text-gray-600 max-w-md mx-auto">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="max-w-lg mx-auto my-10 border border-red-200 bg-red-50 rounded-xl p-6 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" aria-hidden />
      <p className="text-red-800 font-medium">Something went wrong</p>
      <p className="text-sm text-red-700 mt-1">{message}</p>
      {onRetry && <Button onClick={onRetry} variant="outline" className="mt-4 gap-2"><RefreshCw className="h-4 w-4" />Try again</Button>}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
      <div>
        <h2 className="text-2xl md:text-3xl text-gray-800 font-semibold">{title}</h2>
        {subtitle && <p className="text-gray-600 mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
