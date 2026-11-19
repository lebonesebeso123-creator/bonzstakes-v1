"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Analyser from "@/components/analyse/Analyser";
import { useAppState, useHydrated } from "@/lib/store";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

function Loader() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const state = useAppState();
  if (!hydrated) return <Skeleton />;
  const id = params.get("load");
  const initial = id ? state.analyses.find((a) => a.id === id) : undefined;
  return <Analyser key={initial?.id ?? "new"} initial={initial} />;
}

export default function Home() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Loader />
    </Suspense>
  );
}
