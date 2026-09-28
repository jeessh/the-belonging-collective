"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is still vendor-prefixed and untyped in the DOM lib.
type AnyRecognition = any;

function RecognitionCtor(): AnyRecognition | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/** "jesse huang" → "Jesse huang": a name, so the first letter is upper case. */
function capitalize(text: string): string {
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * One phrase, dictated into one field.
 *
 * Not the voice-command listener (`useSpeechCommands`), which matches a closed
 * vocabulary continuously: this takes open speech, once, and hands back the
 * words. `start` resolves the field's new text — an empty string when nothing
 * was heard, null when the microphone is denied or missing — and a second
 * `start` while listening drops the first. Shared with the command listener: a
 * denied microphone latches `denied` so the button can't be pressed into a
 * loop, and any text-to-speech in flight is cancelled so the recognizer never
 * hears the bot.
 */
export function useDictation() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const recRef = useRef<AnyRecognition>(null);

  // Drop the current session without reporting anything to its field —
  // its onend would otherwise hand back an empty phrase.
  const discard = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  useEffect(() => {
    setSupported(!!RecognitionCtor());
    return discard;
  }, [discard]);

  const start = useCallback(
    (onText: (text: string | null) => void) => {
      const Ctor = RecognitionCtor();
      if (!Ctor) return;
      discard();
      window.speechSynthesis?.cancel();

      const rec: AnyRecognition = new Ctor();
      recRef.current = rec;
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.lang = "en-US";

      let heard = "";
      let blocked = false;
      rec.onstart = () => setListening(true);
      rec.onresult = (e: any) => {
        heard = String(e.results?.[0]?.[0]?.transcript ?? "");
      };
      rec.onerror = (e: any) => {
        if (
          e?.error === "not-allowed" ||
          e?.error === "service-not-allowed" ||
          e?.error === "audio-capture"
        ) {
          blocked = true;
          setDenied(true);
        }
        // "no-speech" and "aborted" fall through to onend with nothing heard.
      };
      rec.onend = () => {
        setListening(false);
        if (recRef.current === rec) recRef.current = null;
        onText(blocked ? null : capitalize(heard));
      };

      try {
        rec.start();
      } catch {
        setListening(false);
      }
    },
    [discard],
  );

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { supported, listening, denied, start, stop };
}
