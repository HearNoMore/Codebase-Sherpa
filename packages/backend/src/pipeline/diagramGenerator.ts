import type { ArchitectureData, ArchitectureComponent } from "../types/analysis.js";

export interface DiagramNode {
  id: string;
  type: "custom";
  data: {
    label: string;
    description: string;
    files: string[];
    componentType: ArchitectureComponent["type"];
  };
  position: { x: number; y: number };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// Horizontal spacing between columns, vertical spacing between nodes
const COL_WIDTH = 280;
const ROW_HEIGHT = 160;

// Render order: external inputs → core logic → data stores
const TYPE_ORDER: ArchitectureComponent["type"][] = [
  "external",
  "core",
  "service",
  "utility",
  "data",
];

/**
 * Converts ArchitectureData into React Flow-compatible nodes and edges.
 * Uses a simple column-based layout grouped by component type.
 * No LLM calls — pure structural transformation.
 */
export function generateDiagramData(architecture: ArchitectureData): DiagramData {
  const { components, relationships } = architecture;

  // Group components by type, preserving original order within each group
  const groups = new Map<ArchitectureComponent["type"], ArchitectureComponent[]>();
  for (const type of TYPE_ORDER) groups.set(type, []);

  for (const comp of components) {
    const group = groups.get(comp.type);
    if (group) group.push(comp);
    else groups.get("utility")!.push(comp); // fallback
  }

  // Assign positions column by column (left → right by type order)
  const nodes: DiagramNode[] = [];
  let col = 0;

  for (const type of TYPE_ORDER) {
    const group = groups.get(type) ?? [];
    if (group.length === 0) continue;

    group.forEach((comp, row) => {
      nodes.push({
        id: comp.id,
        type: "custom",
        data: {
          label: comp.label,
          description: comp.description,
          files: comp.files,
          componentType: comp.type,
        },
        position: { x: col * COL_WIDTH, y: row * ROW_HEIGHT },
      });
    });
    col++;
  }

  const edges: DiagramEdge[] = relationships.map((rel, i) => ({
    id: `edge-${i}`,
    source: rel.from,
    target: rel.to,
    label: rel.label,
    animated: true,
  }));

  return { nodes, edges };
}
