"use client";

import { useEffect, useState } from "react";
import type { ModelInfo } from "./types";

export interface ProviderSummary {
  id: string;
  name: string;
  models: ModelInfo[];
  configured: boolean;
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data: { providers: ProviderSummary[] }) => {
        if (!cancelled) setProviders(data.providers);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { providers, loading };
}
