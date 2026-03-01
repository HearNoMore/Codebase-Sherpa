import type { JobStatus } from "../types/analysis";

interface ProgressTrackerProps {
  status: JobStatus;
}

const STAGES = [
  { key: "cloning",     label: "Clone" },
  { key: "scanning",    label: "Scan" },
  { key: "ranking",     label: "Rank" },
  { key: "analyzing",   label: "Analyze" },
  { key: "synthesizing",label: "Synthesize" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function getStageState(stageKey: StageKey, currentStatus: JobStatus["status"]): "done" | "active" | "pending" {
  const order: JobStatus["status"][] = ["queued", "cloning", "scanning", "ranking", "analyzing", "synthesizing", "done"];
  const stageIdx = order.indexOf(stageKey);
  const currentIdx = order.indexOf(currentStatus);
  if (currentIdx > stageIdx) return "done";
  if (currentIdx === stageIdx) return "active";
  return "pending";
}

export default function ProgressTracker({ status }: ProgressTrackerProps) {
  const pct = Math.round(status.progress * 100);

  return (
    <div className="w-full max-w-xl space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{status.currentStep ?? "Starting…"}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Pipeline stage pills */}
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((stage, i) => {
          const state = getStageState(stage.key, status.status);
          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    state === "done"   ? "bg-indigo-600 text-white" : "",
                    state === "active" ? "bg-indigo-400 text-white ring-2 ring-indigo-300 ring-offset-2 ring-offset-gray-950" : "",
                    state === "pending"? "bg-gray-800 text-gray-600" : "",
                  ].join(" ")}
                >
                  {state === "done" ? "✓" : i + 1}
                </div>
                <span className={`mt-1 text-xs truncate max-w-full ${state === "active" ? "text-indigo-300" : state === "done" ? "text-gray-400" : "text-gray-600"}`}>
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`h-px flex-1 mx-1 mb-4 ${state === "done" ? "bg-indigo-600" : "bg-gray-800"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error state */}
      {status.status === "error" && (
        <div className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Analysis failed: </span>
          {status.errorMessage ?? "An unknown error occurred."}
        </div>
      )}
    </div>
  );
}
