import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common";

export default function NotFound() {
  return (
    <EmptyState icon={<Compass className="h-8 w-8" />} title="Page not found" text="The link may be broken or the page was moved."
      action={<div className="flex gap-3 justify-center"><Button asChild className="bg-green-600 hover:bg-green-700"><Link to="/">Go home</Link></Button><Button asChild variant="outline"><Link to="/shop">Browse items</Link></Button></div>} />
  );
}
