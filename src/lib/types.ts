export type Condition = "New" | "Like New" | "Excellent" | "Good" | "Fair";
export type ListingType = "sell" | "donate";

export interface Category { id: number; slug: string; name: string; description: string | null; image_url: string | null; sort_order: number; }
export interface Ngo { id: number; name: string; city: string; description: string | null; }

export interface Profile {
  id: string; auth_id: string | null; full_name: string; email: string;
  phone: string | null; city: string | null; avatar_url: string | null; bio: string | null; created_at: string;
}

export interface ItemFull {
  id: string; seller_id: string; category_id: number; title: string; description: string | null;
  brand: string | null; size: string | null; color: string | null; condition: Condition;
  listing_type: ListingType; price: number; ngo_id: number | null; weight_kg: number;
  status: "active" | "reserved" | "sold" | "donated" | "removed"; views: number;
  created_at: string; updated_at: string;
  category_slug: string; category_name: string; seller_name: string; seller_city: string | null;
  seller_rating: number; seller_review_count: number; ngo_name: string | null;
  cover_image: string | null; images: string[];
}

export interface Review {
  id: string; reviewer_id: string; seller_id: string; item_id: string | null; order_id: string | null;
  rating: number; comment: string | null; helpful_count: number; created_at: string;
}

export interface Order {
  id: string; order_number: string; buyer_id: string; status: "placed" | "shipped" | "delivered" | "cancelled";
  subtotal: number; shipping_fee: number; total: number; payment_method: string; payment_status: string;
  shipping_name: string; shipping_phone: string; address_line: string; city: string; state: string; pincode: string;
  created_at: string;
}

export interface ImpactStats {
  items_rehomed: number; items_donated: number; kg_saved: number; co2_saved_kg: number;
  water_saved_litres: number; items_available: number;
}
