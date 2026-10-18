import { useRef, useState } from "react";

// Voice search using the browser's built-in Web Speech API (Chrome / Edge).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

export function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<AnyRec>(null);
  const w = typeof window !== "undefined" ? (window as AnyRec) : {};
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  const supported = Boolean(Rec);

  const start = () => {
    if (!supported) return false;
    const rec = new Rec();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: AnyRec) => onResult(String(e.results[0][0].transcript).replace(/[.?!]$/, ""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
    return true;
  };
  const stop = () => { recRef.current?.stop(); setListening(false); };

  return { supported, listening, start, stop };
}
