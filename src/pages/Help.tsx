import { Link } from "react-router-dom";
import { HelpCircle, ShieldCheck, Tag, Accessibility, Mail, Keyboard, Mic, Type, Undo2 } from "lucide-react";
import { Breadcrumbs } from "@/components/common";

const FAQ = [
  { q: "How do I buy an item?", a: "Open any item and tap “Buy now”, or add several items to your cart. Checkout has three short steps — address, payment and review — and you can go back to change anything before you pay." },
  { q: "How do I request a free (donated) item?", a: "Open the item and use “Request this free item”. The donor sees your request in their dashboard and can approve it. You can track the status under Dashboard → Donations." },
  { q: "Can I undo something?", a: "Yes. Adding or removing items from your cart or wishlist shows an “Undo” button for a few seconds. Listings can be hidden instead of deleted, and deleting always asks you to confirm first." },
  { q: "When can I review a seller?", a: "After your order arrives, press “I've received it” in Dashboard → My orders. A “Rate seller” button then appears next to each item." },
  { q: "Is my payment information stored?", a: "No. Checkout on EcoThreads is a demonstration — payments are simulated, no money is charged and payment details are never saved." },
];

export default function Help() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Help" }]} />
      <h1 className="text-3xl font-semibold text-gray-800 flex items-center gap-3"><HelpCircle className="h-8 w-8 text-green-600" />Help centre</h1>
      <p className="text-gray-600 mt-2">Quick answers to common questions. Still stuck? Use the <span className="font-medium">Feedback</span> button at the bottom-left of any page.</p>

      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="text-xl font-semibold mb-4">Frequently asked questions</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="border rounded-lg p-4 bg-white group">
              <summary className="cursor-pointer font-medium text-gray-800 list-none flex justify-between items-center">
                {f.q}<span className="text-green-600 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="text-gray-600 mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="selling" className="mt-10 scroll-mt-24" aria-labelledby="sell-h">
        <h2 id="sell-h" className="text-xl font-semibold mb-3 flex items-center gap-2"><Tag className="h-5 w-5 text-green-600" />Pricing guide for sellers</h2>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          <li>Most pre-loved items sell for 30–50% of their original price.</li>
          <li>When you pick a category on the listing form, we show the price range of similar items.</li>
          <li>Clear photos in daylight and an honest condition label sell faster.</li>
          <li>Orders above ₹999 ship free for the buyer — pricing just under that rarely helps.</li>
        </ul>
      </section>

      <section id="safety" className="mt-10 scroll-mt-24" aria-labelledby="safe-h">
        <h2 id="safe-h" className="text-xl font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-600" />Safety tips</h2>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          <li>Keep payments inside EcoThreads checkout — never pay a seller directly.</li>
          <li>Your email and phone are never shown publicly on listings or reviews.</li>
          <li>Check the seller's rating and reviews before buying.</li>
        </ul>
      </section>

      <section id="accessibility" className="mt-10 scroll-mt-24" aria-labelledby="a11y-h">
        <h2 id="a11y-h" className="text-xl font-semibold mb-3 flex items-center gap-2"><Accessibility className="h-5 w-5 text-green-600" />Accessibility &amp; shortcuts</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Type, t: "Bigger text", d: "Tap the “T” icon in the header to switch between normal, large and extra-large text." },
            { icon: Mic, t: "Voice search", d: "Tap the microphone in the search bar and say what you're looking for (Chrome & Edge)." },
            { icon: Keyboard, t: "Keyboard friendly", d: "Press / to jump to search. Use Tab to move, Enter to select, Esc to close dialogs." },
            { icon: Undo2, t: "Forgiving actions", d: "Undo buttons on cart and wishlist changes; confirmations before anything is deleted." },
          ].map((x) => (
            <li key={x.t} className="border rounded-lg p-4 bg-white">
              <p className="font-medium flex items-center gap-2"><x.icon className="h-4 w-4 text-green-600" />{x.t}</p>
              <p className="text-sm text-gray-600 mt-1">{x.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border rounded-xl p-5 bg-green-50 flex items-start gap-3">
        <Mail className="h-5 w-5 text-green-700 mt-0.5" />
        <div>
          <p className="font-medium">Contact us</p>
          <p className="text-sm text-gray-700">Email <a href="mailto:hello@ecothreads.example" className="underline">hello@ecothreads.example</a> or see <Link to="/impact" className="underline">our impact</Link> so far.</p>
        </div>
      </section>
    </div>
  );
}
