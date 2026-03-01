import { useState, useEffect, useRef } from "react";
import { apiUrl } from "../lib/api";
import type { JobStatus } from "../types/analysis";

const POLL_INTERVAL_MS = 1500;

interface UseAnalysisStatusResult {
  status: JobStatus | null;
  error: string | null;
}

export function useAnalysisStatus(jobId: string | undefined): UseAnalysisStatusResult {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/status/${jobId}`));
        if (!res.ok) {
          setError(`Failed to fetch status (${res.status})`);
          return;
        }
        const data = (await res.json()) as JobStatus;
        setStatus(data);

        // Stop polling once terminal state reached
        if (data.status === "done" || data.status === "error") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        setError("Network error while polling status");
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return { status, error };
}
