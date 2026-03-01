import type { RepoAnalysis } from "../types/analysis";

interface OverviewProps {
  analysis: RepoAnalysis;
  repoUrl: string;
}

const CATEGORY_ORDER = ["framework", "language", "database", "testing", "tooling", "library", "infrastructure"];

function groupByCategory(techStack: RepoAnalysis["overview"]["techStack"]) {
  const grouped: Record<string, typeof techStack> = {};
  for (const item of techStack) {
    const cat = item.category ?? "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  // Sort categories by known order, then alphabetically
  return Object.entries(grouped).sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-500",
  Rust: "bg-orange-500",
  Go: "bg-cyan-400",
  Java: "bg-red-500",
  "C++": "bg-purple-500",
  Ruby: "bg-red-400",
  CSS: "bg-pink-400",
  HTML: "bg-orange-400",
  Shell: "bg-gray-400",
  Markdown: "bg-gray-500",
};

function langColor(name: string): string {
  return LANG_COLORS[name] ?? "bg-indigo-500";
}

export default function Overview({ analysis, repoUrl }: OverviewProps) {
  const { overview } = analysis;
  const grouped = groupByCategory(overview.techStack);

  return (
    <div className="space-y-8">
      {/* Repo link */}
      <div className="flex items-center gap-3">
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-mono truncate"
        >
          {repoUrl}
        </a>
      </div>

      {/* Summary */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Summary</h2>
        <div className="space-y-3 text-gray-300 leading-relaxed">
          {overview.summary.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para.trim()}</p>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Repository Stats</h2>
        <div className="grid grid-cols-3 gap-4">
          {([
            ["Total Files", overview.stats.totalFiles.toLocaleString()],
            ["Total Lines", overview.stats.totalLines.toLocaleString()],
            ["Files Analyzed", overview.stats.analyzedFiles.toLocaleString()],
          ] as const).map(([label, value]) => (
            <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Language breakdown */}
      {overview.languages.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Languages</h2>
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden">
              {overview.languages.map((lang) => (
                <div
                  key={lang.name}
                  className={langColor(lang.name)}
                  style={{ width: `${lang.percentage}%` }}
                  title={`${lang.name}: ${lang.percentage}%`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {overview.languages.map((lang) => (
                <div key={lang.name} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${langColor(lang.name)}`} />
                  <span className="text-xs text-gray-400">
                    {lang.name} <span className="text-gray-600">{lang.percentage}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tech stack */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">Tech Stack</h2>
        <div className="space-y-3">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <span className="text-xs text-gray-600 uppercase tracking-wider mb-1.5 block capitalize">
                {category}
              </span>
              <div className="flex flex-wrap gap-2">
                {items.map((t) => (
                  <span
                    key={t.name}
                    className="px-3 py-1 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-medium"
                  >
                    {t.name}
                    {t.version && (
                      <span className="text-indigo-500 ml-1">v{t.version}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
