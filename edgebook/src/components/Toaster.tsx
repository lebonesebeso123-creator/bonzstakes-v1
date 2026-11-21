"use client";

import { useEffect, useState } from "react";

type Listener = (m: { id: number; text: string }) => void;
let listener: Listener | null = null;
let counter = 0;

export function toast(text: string) {
  listener?.({ id: ++counter, text });
}

export default function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);

  useEffect(() => {
    listener = (m) => {
      setItems((cur) => [...cur.slice(-2), m]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== m.id)), 3500);
    };
    return () => {
      listener = null;
    };
  }, []);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-40 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-24"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="card pointer-events-auto max-w-sm px-4 py-2.5 text-sm shadow-xl"
          style={{ background: "rgba(15,23,42,0.95)" }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
