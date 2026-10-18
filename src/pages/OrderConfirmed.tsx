import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Package, Truck, Home as HomeIcon, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import { formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderConfirmed() {
  const { orderNumber = "" } = useParams();
  const { state } = useLocation() as { state?: { order?: Order } };
  const { data: order, error } = useAsync(async () => {
    if (state?.order) return state.order;
    const { data, error } = await supabase.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
    if (error) throw error;
    return data as Order | null;
  }, [orderNumber]);

  if (error) return <ErrorState message={error} />;
  const steps = [
    { icon: CheckCircle2, label: "Order placed", done: true },
    { icon: Package, label: "Seller packs it", done: false },
    { icon: Truck, label: "On the way", done: false },
    { icon: HomeIcon, label: "Delivered", done: false },
  ];

  return (
    <div className="container mx-auto px-4 py-14 max-w-2xl text-center">
      <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" aria-hidden />
      <h1 className="text-3xl font-semibold text-gray-800 mt-4">Thank you! Your order is placed.</h1>
      <p className="text-gray-600 mt-2">Order number <span className="font-mono font-semibold text-gray-800">{orderNumber}</span></p>
      {order && (
        <p className="text-gray-600 mt-1">
          {formatINR(order.total)} · {order.payment_status === "paid" ? "Paid" : "Pay on delivery"} · Delivering to {order.city}
        </p>
      )}

      <ol className="flex justify-between mt-10 mb-10 relative" aria-label="Order progress">
        <span className="absolute top-5 left-[12%] right-[12%] h-0.5 bg-gray-200" aria-hidden />
        {steps.map((s) => (
          <li key={s.label} className="relative flex flex-col items-center gap-2 flex-1">
            <span className={`h-10 w-10 rounded-full flex items-center justify-center ${s.done ? "bg-green-600 text-white" : "bg-white border-2 text-gray-400"}`}><s.icon className="h-5 w-5" /></span>
            <span className={`text-xs ${s.done ? "text-gray-800 font-medium" : "text-gray-500"}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      <p className="text-sm text-green-800 bg-green-50 rounded-lg p-3 inline-flex items-center gap-2"><Leaf className="h-4 w-4" />By buying pre-loved you've kept clothes out of landfill. 🌍</p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/account?tab=orders">Track in my dashboard</Link></Button>
        <Button asChild variant="outline"><Link to="/shop">Continue shopping</Link></Button>
      </div>
    </div>
  );
}
