import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnalysisStatus } from "../hooks/useAnalysisStatus";
import ProgressTracker from "../components/ProgressTracker";
import { apiUrl } from "../lib/api";
import type { AnalysisResult } from "../types/analysis";

export default function Analysis() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { status, error: pollError } = useAnalysisStatus(jobId);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Fetch full results once the job is done
  useEffect(() => {
    if (status?.status !== "done") return;

    fetch(apiUrl(`/api/results/${jobId}`))
      .then((r) => r.json())
      .then((data: AnalysisResult) => setResult(data))
      .catch(() => {/* handled below */});
  }, [status?.status, jobId]);

  if (!jobId) {
    navigate("/");
    return null;
  }

  if (pollError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{pollError}</p>
          <button onClick={() => navigate("/")} className="text-sm text-indigo-400 hover:underline">
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  // Still running — show progress tracker
  if (status.status !== "done" && status.status !== "error") {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4 gap-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-1">Analyzing repository…</h2>
          <p className="text-sm text-gray-500">This usually takes 30–90 seconds</p>
        </div>
        <ProgressTracker status={status} />
        <button
          onClick={() => navigate("/")}
          className="mt-8 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          ← Cancel and go back
        </button>
      </div>
    );
  }

  // Error state
  if (status.status === "error") {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4 gap-6">
        <ProgressTracker status={status} />
        <button onClick={() => navigate("/")} className="text-sm text-indigo-400 hover:underline">
          ← Try another repository
        </button>
      </div>
    );
  }

  // Done — full dashboard (Days 4–6 will fill this in)
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/")} className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">
            ← Home
          </button>
          <h1 className="text-lg font-bold font-mono">
            {result?.repoName ?? status.jobId}
          </h1>
          {result && (
            <p className="text-sm text-gray-400">{result.analysis.overview.purpose}</p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {result ? (
          <div className="space-y-6">
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Overview</h2>
              <p className="text-gray-300 leading-relaxed">{result.analysis.overview.summary}</p>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Tech Stack</h2>
              <div className="flex flex-wrap gap-2">
                {result.analysis.overview.techStack.map((t) => (
                  <span key={t.name} className="px-3 py-1 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-medium">
                    {t.name}
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Stats</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["Files", result.analysis.overview.stats.totalFiles],
                  ["Lines", result.analysis.overview.stats.totalLines.toLocaleString()],
                  ["Analyzed", result.analysis.overview.stats.analyzedFiles],
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="text-gray-500 text-sm animate-pulse text-center">Loading results…</div>
        )}
      </main>
    </div>
  );
}
