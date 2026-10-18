import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquareHeart, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { supabase, friendlyError } from "@/lib/supabase";
import { useApp } from "@/lib/store";

const FACES = [
  { v: 1, e: "😣", t: "Very hard" },
  { v: 2, e: "🙁", t: "Hard" },
  { v: 3, e: "😐", t: "Okay" },
  { v: 4, e: "🙂", t: "Easy" },
  { v: 5, e: "😄", t: "Very easy" },
];

const TASKS = ["Browsing items", "Searching for something", "Listing / donating an item", "Buying (cart & checkout)", "Managing my account", "Just looking around"];

function pageName(path: string) {
  if (path === "/") return "home";
  if (path.startsWith("/item")) return "item-details";
  if (path.startsWith("/order")) return "order-confirmed";
  if (path.startsWith("/sell")) return "sell-form";
  return path.replace("/", "") || "home";
}

export function FeedbackWidget() {
  const { pathname } = useLocation();
  const { profile } = useApp();
  const [open, setOpen] = useState(false);
  const [ease, setEase] = useState(0);
  const [sat, setSat] = useState(0);
  const [task, setTask] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!ease) { toast.error("Please pick how easy this page was"); return; }
    setBusy(true);
    const w = window.innerWidth;
    const { error } = await supabase.from("feedback").insert({
      profile_id: profile?.id ?? null,
      page: pageName(pathname),
      task: task || null,
      ease_rating: ease,
      satisfaction: sat || null,
      comment: comment.trim() || null,
      device: w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop",
    });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Thank you! Your feedback helps us improve EcoThreads.");
    setOpen(false); setEase(0); setSat(0); setTask(""); setComment("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-30 flex items-center gap-2 bg-white border border-green-200 text-green-800 shadow-lg rounded-full px-4 py-2 text-sm hover:bg-green-50"
        aria-label="Give feedback about this page"
      >
        <MessageSquareHeart className="h-4 w-4" /> <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How was this page?</DialogTitle>
            <DialogDescription>Takes 10 seconds. Anonymous unless you're signed in.</DialogDescription>
          </DialogHeader>

          <fieldset>
            <legend className="text-sm font-medium mb-2">How easy was it to do what you wanted?</legend>
            <div className="flex justify-between gap-1" role="radiogroup">
              {FACES.map((f) => (
                <button key={f.v} type="button" role="radio" aria-checked={ease === f.v} aria-label={f.t}
                  onClick={() => setEase(f.v)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-2xl transition ${ease === f.v ? "border-green-600 bg-green-50" : "border-transparent hover:bg-gray-50"}`}>
                  {f.e}<span className="text-[11px] text-gray-600">{f.t}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium mb-2">Overall satisfaction <span className="text-gray-400 font-normal">(optional)</span></legend>
            <div className="flex gap-1" role="radiogroup">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" role="radio" aria-checked={sat === s} aria-label={`${s} out of 5`}
                  onClick={() => setSat(s)} className={`text-2xl ${s <= sat ? "text-yellow-400" : "text-gray-300"} hover:scale-110 transition`}>★</button>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="fb-task" className="text-sm">What were you trying to do?</Label>
            <select id="fb-task" value={task} onChange={(e) => setTask(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Choose one (optional)</option>
              {TASKS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <Label htmlFor="fb-comment" className="text-sm">Anything confusing or missing?</Label>
            <Textarea id="fb-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us in your own words…" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy} className="bg-green-600 hover:bg-green-700 gap-2"><Send className="h-4 w-4" />{busy ? "Sending…" : "Send feedback"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
