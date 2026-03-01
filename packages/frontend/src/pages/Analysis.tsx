import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnalysisStatus } from "../hooks/useAnalysisStatus";
import ProgressTracker from "../components/ProgressTracker";
import Overview from "../components/Overview";
import FileExplorer from "../components/FileExplorer";
import { apiUrl } from "../lib/api";
import type { AnalysisResult } from "../types/analysis";

type Tab = "overview" | "architecture" | "files" | "contribute";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",     label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "files",        label: "Files" },
  { id: "contribute",   label: "Contribute" },
];

export default function Analysis() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { status, error: pollError } = useAnalysisStatus(jobId);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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

  // Done — full dashboard
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button onClick={() => navigate("/")} className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">
              ← Home
            </button>
            <h1 className="text-lg font-bold font-mono truncate">
              {result?.repoName ?? status.jobId}
            </h1>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">{result.analysis.overview.purpose}</p>
            )}
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="border-b border-gray-800 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-300"
                  : "border-transparent text-gray-500 hover:text-gray-300",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {result ? (
          <div className="h-full max-w-6xl mx-auto px-6 py-8">
            {activeTab === "overview" && (
              <Overview analysis={result.analysis} repoUrl={result.repoUrl} />
            )}

            {activeTab === "architecture" && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-4xl mb-4">🏗️</div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Architecture Diagram</h3>
                <p className="text-sm text-gray-500">Coming in Day 5 — interactive React Flow diagram</p>
              </div>
            )}

            {activeTab === "files" && (
              <div className="h-full" style={{ minHeight: "60vh" }}>
                <FileExplorer
                  tree={result.analysis.fileTree}
                  fileAnalyses={result.analysis.fileAnalyses}
                />
              </div>
            )}

            {activeTab === "contribute" && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-4xl mb-4">🤝</div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Contributor Guide</h3>
                <p className="text-sm text-gray-500">Coming in Day 6 — setup, workflow, and gotchas</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500 text-sm animate-pulse">Loading results…</div>
          </div>
        )}
      </main>
    </div>
  );
}
