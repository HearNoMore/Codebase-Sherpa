import { useState } from "react";
import type { AnnotatedFileNode, FileAnalysis } from "../types/analysis";

interface FileExplorerProps {
  tree: AnnotatedFileNode[];
  fileAnalyses: FileAnalysis[];
}

const IMPORTANCE_STYLES: Record<string, string> = {
  high:   "text-green-400",
  medium: "text-yellow-400",
  low:    "text-gray-400",
  ignore: "text-gray-700",
};

const IMPORTANCE_DOT: Record<string, string> = {
  high:   "bg-green-500",
  medium: "bg-yellow-500",
  low:    "bg-gray-500",
  ignore: "bg-gray-800",
};

function FileIcon({ type, expanded }: { type: "file" | "directory"; expanded?: boolean }) {
  if (type === "directory") {
    return <span className="text-gray-500 select-none">{expanded ? "▾" : "▸"}</span>;
  }
  return <span className="text-gray-700 select-none">·</span>;
}

interface TreeNodeProps {
  node: AnnotatedFileNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (node: AnnotatedFileNode) => void;
}

function TreeNode({ node, depth, selectedPath, onSelectFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isSelected = node.path === selectedPath;
  const isIgnored = node.importance === "ignore";

  if (isIgnored && node.type === "directory") return null;

  const indent = depth * 16;

  const handleClick = () => {
    if (node.type === "directory") {
      setExpanded((e) => !e);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={[
          "w-full text-left flex items-start gap-2 py-1 px-2 rounded-md text-sm transition-colors group",
          node.type === "file" ? "cursor-pointer" : "cursor-default",
          isSelected
            ? "bg-indigo-950 border border-indigo-800"
            : "hover:bg-gray-900",
          isIgnored ? "opacity-40" : "",
        ].join(" ")}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {/* Expand/collapse / bullet */}
        <span className="mt-0.5 w-4 flex-shrink-0 flex items-center justify-center">
          <FileIcon type={node.type} expanded={expanded} />
        </span>

        {/* Importance dot (files only) */}
        {node.type === "file" && (
          <span
            className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPORTANCE_DOT[node.importance]}`}
            title={`Importance: ${node.importance}`}
          />
        )}

        {/* Name */}
        <span className={[
          "font-mono truncate",
          node.type === "directory" ? "text-gray-300 font-medium" : IMPORTANCE_STYLES[node.importance],
        ].join(" ")}>
          {node.name}
          {node.type === "directory" && "/"}
        </span>

        {/* Annotation preview */}
        {node.annotation && (
          <span className="ml-2 text-xs text-gray-600 truncate hidden sm:block group-hover:text-gray-500">
            {node.annotation}
          </span>
        )}
      </button>

      {node.type === "directory" && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileDetailPanelProps {
  node: AnnotatedFileNode;
  analysis: FileAnalysis | undefined;
  onClose: () => void;
}

function FileDetailPanel({ node, analysis, onClose }: FileDetailPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-gray-500 truncate">{node.path}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium capitalize ${IMPORTANCE_STYLES[node.importance]}`}>
              {node.importance}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-600">importance</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 flex-shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5">
        {/* Annotation */}
        {node.annotation && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Annotation</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{node.annotation}</p>
          </section>
        )}

        {analysis ? (
          <>
            {/* Summary */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Summary</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>
            </section>

            {/* Patterns */}
            {analysis.patterns.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Patterns</h3>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.patterns.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-400">
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Key exports */}
            {analysis.keyExports.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Key Exports</h3>
                <ul className="space-y-1">
                  {analysis.keyExports.map((e) => (
                    <li key={e} className="text-xs font-mono text-indigo-300 bg-indigo-950/50 rounded px-2 py-1">
                      {e}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Dependencies */}
            {analysis.dependencies.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Dependencies</h3>
                <ul className="space-y-1">
                  {analysis.dependencies.map((d) => (
                    <li key={d} className="text-xs font-mono text-gray-400 bg-gray-900 rounded px-2 py-1">
                      {d}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          !node.annotation && (
            <p className="text-sm text-gray-600 italic">No detailed analysis available for this file.</p>
          )
        )}
      </div>
    </div>
  );
}

export default function FileExplorer({ tree, fileAnalyses }: FileExplorerProps) {
  const [selectedNode, setSelectedNode] = useState<AnnotatedFileNode | null>(null);

  const analysisMap = new Map(fileAnalyses.map((f) => [f.path, f]));

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Tree panel */}
      <div className={`overflow-y-auto flex-shrink-0 ${selectedNode ? "w-1/2" : "w-full"} transition-all`}>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 px-2">
          <span className="text-xs text-gray-600">Importance:</span>
          {(["high", "medium", "low"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${IMPORTANCE_DOT[level]}`} />
              <span className="text-xs text-gray-500 capitalize">{level}</span>
            </div>
          ))}
        </div>

        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedNode?.path ?? null}
            onSelectFile={setSelectedNode}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="w-1/2 flex-shrink-0 bg-gray-900 rounded-xl border border-gray-800 p-5 overflow-hidden">
          <FileDetailPanel
            node={selectedNode}
            analysis={analysisMap.get(selectedNode.path)}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  );
}
