import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RepoInput from "../components/RepoInput";
import { apiUrl } from "../lib/api";
import type { RecentJob } from "../types/analysis";

export default function Home() {
  const navigate = useNavigate();
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/recent"))
      .then((r) => r.json())
      .then((data: { jobs: RecentJob[] }) => setRecentJobs(data.jobs ?? []))
      .catch(() => {/* silent — list is optional */});
  }, []);

  const handleJobStarted = (jobId: string) => {
    navigate(`/analysis/${jobId}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight mb-3">
          Codebase Sherpa
        </h1>
        <p className="text-xl text-gray-400">
          Your guide to any repository
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Paste a public GitHub URL — get an interactive architecture map, annotated file explorer, and AI chat in under a minute.
        </p>
      </div>

      <RepoInput onJobStarted={handleJobStarted} />

      {/* Previously analyzed repos */}
      {recentJobs.length > 0 && (
        <div className="mt-14 w-full max-w-2xl">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Recently analyzed
          </h2>
          <ul className="space-y-2">
            {recentJobs.map((job) => (
              <li key={job.id}>
                <button
                  onClick={() => navigate(`/analysis/${job.id}`)}
                  className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-colors group"
                >
                  <span className="text-sm font-mono text-gray-300 group-hover:text-white truncate">
                    {job.repoName}
                  </span>
                  <span className="text-xs text-gray-600 ml-4 shrink-0">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
