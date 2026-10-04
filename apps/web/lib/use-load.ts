"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "./api";

/**
 * Loads data from the API for a signed-in page. A 401 sends the visitor to sign-in.
 * Other errors are returned so each page can explain them (for example "this day is locked").
 */
export function useLoad<T>(path: string) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    api<T>(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e instanceof ApiError ? e : new ApiError(0, "ERROR", "Something went wrong."));
      });
  }, [path, router]);

  useEffect(load, [load]);
  return { data, error, reload: load };
}
