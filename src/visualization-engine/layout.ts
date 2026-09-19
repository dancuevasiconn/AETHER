import type {
  EntityReference,
  SemanticPosition,
  VisualizationView,
  VisualNode,
} from "../visualization/index.js";
import { APS_LABELS, DEFAULT_RENDERER_CONFIGURATION, LEVEL_LABELS } from "./configuration.js";
import { anchors, connectingAnchors, routePath } from "./geometry.js";
import type {
  EngineColumn,
  EngineLevel,
  RenderEdge,
  RenderNode,
  RendererConfiguration,
  RenderRegion,
  RenderRoute,
  RenderScene,
} from "./types.js";

const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function regionKey(position: SemanticPosition): string {
  const level = position.architectureLevel ?? position.presentationLevel;
  if (position.apsLayer && level) return `cell:${position.apsLayer}:${level}`;
  if (level) return `level:${level}`;
  if (position.apsLayer) return `column:${position.apsLayer}`;
  return position.positioningState === "UNPOSITIONED" ? "unpositioned" : "support";
}
function nodeLabel(node: VisualNode): string {
  return node.label?.trim() || `${node.entityType}: ${node.entityId}`;
}
function makeNode(
  node: VisualNode,
  x: number,
  y: number,
  width: number,
  region: string,
  degraded = false,
): RenderNode {
  const chip = node.entityType === "DataObject";
  const marker = node.entityType === "FlowSegment" || node.entityType === "Relationship";
  const height = chip ? 36 : marker ? 44 : 64;
  return {
    key: node.key,
    entityType: node.entityType,
    entityId: node.entityId,
    label: nodeLabel(node),
    x,
    y,
    width: chip ? Math.min(width, 152) : marker ? Math.min(width, 136) : width,
    height,
    anchors: anchors(
      x,
      y,
      chip ? Math.min(width, 152) : marker ? Math.min(width, 136) : width,
      height,
    ),
    regionKey: region,
    kind: degraded ? "ghost" : chip ? "chip" : marker ? "marker" : "node",
    exposure: node.exposure,
    focused: node.focused,
    selected: node.selected,
    attenuated: node.emphasis === "ATTENUATED",
    degraded,
  };
}
export function layoutVisualization(
  view: VisualizationView,
  configuration: RendererConfiguration = {},
): RenderScene {
  const cellWidth = configuration.cellWidth ?? DEFAULT_RENDERER_CONFIGURATION.cellWidth,
    nodeWidth = configuration.nodeWidth ?? DEFAULT_RENDERER_CONFIGURATION.nodeWidth,
    rowGap = configuration.rowGap ?? DEFAULT_RENDERER_CONFIGURATION.rowGap;
  const columns: EngineColumn[] = (
    configuration.columns ??
    DEFAULT_RENDERER_CONFIGURATION.columns ??
    view.semanticFrame.apsLayers.map((id) => ({ id, label: APS_LABELS[id] ?? id }))
  ).map((x) => ({ ...x }));
  const levels: EngineLevel[] = (
    configuration.levels ??
    DEFAULT_RENDERER_CONFIGURATION.levels ??
    view.semanticFrame.architectureLevels.map((id) => ({ id, label: LEVEL_LABELS[id] ?? id }))
  ).map((x) => ({ ...x }));
  const labelWidth = 140,
    headerHeight = 64,
    cellPadding = 18,
    baseRowHeight = 236,
    levelBandWidth = 220;
  const routeEndpoints = new Set(
    view.routes
      .filter((route) => route.visibility === "VISIBLE")
      .flatMap((route) =>
        route.segments.flatMap((segment) => [
          `${segment.source.entityType}:${segment.source.entityId}`,
          `${segment.target.entityType}:${segment.target.entityId}`,
        ]),
      ),
  );
  const candidates = view.nodes.filter(
    (node) =>
      node.visibility === "VISIBLE" ||
      (node.visibility === "HIDDEN" &&
        (node.focused || routeEndpoints.has(`${node.entityType}:${node.entityId}`))),
  );
  const grouped = new Map<string, VisualNode[]>();
  for (const node of candidates) {
    if (node.entityType === "Architecture" || node.entityType === "FlowFamily") continue;
    const key = regionKey(node.semanticPosition);
    const values = grouped.get(key) ?? [];
    values.push(node);
    grouped.set(key, values);
  }
  for (const values of grouped.values()) values.sort((a, b) => ordinal(a.key, b.key));
  const rowHeights = levels.map((level) =>
    Math.max(
      baseRowHeight,
      (grouped.get(`level:${level.id}`)?.length ?? 0) * 84 + 40,
      ...columns.map(
        (column) => (grouped.get(`cell:${column.id}:${level.id}`)?.length ?? 0) * 84 + 40,
      ),
    ),
  );
  const gridWidth = columns.length * cellWidth,
    totalMainWidth = labelWidth + gridWidth + levelBandWidth;
  const regions: RenderRegion[] = [];
  let y = headerHeight;
  for (let r = 0; r < levels.length; r += 1) {
    const level = levels[r]!;
    regions.push({
      key: `level-label:${level.id}`,
      kind: "LEVEL_BAND",
      label: level.label,
      x: 0,
      y,
      width: labelWidth,
      height: rowHeights[r]!,
    });
    for (let c = 0; c < columns.length; c += 1) {
      const column = columns[c]!;
      regions.push({
        key: `cell:${column.id}:${level.id}`,
        kind: "CELL",
        label: `${column.label} / ${level.label}`,
        x: labelWidth + c * cellWidth,
        y,
        width: cellWidth,
        height: rowHeights[r]!,
        column: column.id,
        level: level.id,
      });
    }
    regions.push({
      key: `level:${level.id}`,
      kind: "LEVEL_BAND",
      label: `${level.label} / APS unspecified`,
      x: labelWidth + gridWidth,
      y,
      width: levelBandWidth,
      height: rowHeights[r]!,
      level: level.id,
    });
    y += rowHeights[r]!;
  }
  const partialHeight = Math.max(
    120,
    ...columns.map((column) => (grouped.get(`column:${column.id}`)?.length ?? 0) * 60 + 50),
  );
  for (let c = 0; c < columns.length; c += 1) {
    const column = columns[c]!;
    regions.push({
      key: `column:${column.id}`,
      kind: "COLUMN_BAND",
      label: `${column.label} / level unspecified`,
      x: labelWidth + c * cellWidth,
      y,
      width: cellWidth,
      height: partialHeight,
      column: column.id,
    });
  }
  regions.push({
    key: "unpositioned",
    kind: "UNPOSITIONED",
    label: "Position not provided",
    x: 0,
    y: y + partialHeight,
    width: totalMainWidth,
    height: Math.max(120, (grouped.get("unpositioned")?.length ?? 0) * 60 + 50),
  });
  const supportY = y + partialHeight + regions.at(-1)!.height;
  regions.push({
    key: "support",
    kind: "SUPPORT",
    label: "Context and support",
    x: 0,
    y: supportY,
    width: totalMainWidth,
    height: Math.max(120, (grouped.get("support")?.length ?? 0) * 60 + 50),
  });
  const regionMap = new Map(regions.map((region) => [region.key, region]));
  const nodes: RenderNode[] = [];
  for (const [key, values] of grouped) {
    const region = regionMap.get(key);
    if (!region) continue;
    for (let i = 0; i < values.length; i += 1) {
      const source = values[i]!;
      const compact = region.kind !== "CELL" && region.kind !== "LEVEL_BAND";
      const cols = compact
        ? Math.max(1, Math.floor((region.width - 2 * cellPadding) / (nodeWidth + rowGap)))
        : 1;
      const col = i % cols,
        row = Math.floor(i / cols);
      nodes.push(
        makeNode(
          source,
          region.x + cellPadding + col * (nodeWidth + rowGap),
          region.y + 34 + row * (compact ? 56 : 84),
          nodeWidth,
          key,
          source.visibility === "HIDDEN",
        ),
      );
    }
  }
  nodes.sort((a, b) => ordinal(a.key, b.key));
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const edgeGroups = new Map<string, typeof view.edges>();
  for (const edge of view.edges.filter((edge) => edge.visibility === "VISIBLE")) {
    const key = [edge.sourceVisualNodeKey, edge.targetVisualNodeKey].sort(ordinal).join("|");
    edgeGroups.set(key, [...(edgeGroups.get(key) ?? []), edge]);
  }
  const edges: RenderEdge[] = [];
  for (const values of edgeGroups.values()) {
    const ordered = [...values].sort((a, b) => ordinal(a.graphEdgeKey, b.graphEdgeKey));
    for (let i = 0; i < ordered.length; i += 1) {
      const edge = ordered[i]!,
        source = nodeByKey.get(edge.sourceVisualNodeKey),
        target = nodeByKey.get(edge.targetVisualNodeKey);
      if (!source || !target) continue;
      const [a, b] = connectingAnchors(source, target),
        offset = (i - (ordered.length - 1) / 2) * 16;
      edges.push({
        key: edge.graphEdgeKey,
        source: source.key,
        target: target.key,
        edgeType: edge.edgeType,
        path: routePath(a, b, offset),
        markerEnd: "edge-arrow",
        emphasis: edge.emphasis,
        multiedgeIndex: i,
        multiedgeCount: ordered.length,
      });
    }
  }
  edges.sort((a, b) => ordinal(a.key, b.key));
  const findRef = (ref: EntityReference) =>
    nodes.find((node) => node.entityType === ref.entityType && node.entityId === ref.entityId);
  const routes: RenderRoute[] = view.routes
    .filter((route) => route.visibility === "VISIBLE")
    .map((route) => ({
      key: route.graphNodeKey,
      flow: route.flow,
      segments: [...route.segments]
        .sort((a, b) => a.sequence - b.sequence || ordinal(a.graphNodeKey, b.graphNodeKey))
        .map((segment) => {
          const source = findRef(segment.source),
            target = findRef(segment.target);
          return {
            key: segment.graphNodeKey,
            flow: route.flow,
            segment: segment.reference,
            sequence: segment.sequence,
            source: segment.source,
            target: segment.target,
            ...(source && target
              ? {
                  path: routePath(
                    connectingAnchors(source, target)[0],
                    connectingAnchors(source, target)[1],
                  ),
                }
              : {}),
            status: source && target ? ("COMPLETE" as const) : ("INCOMPLETE" as const),
            dataObjects: segment.dataObjects,
          };
        }),
    }));
  return {
    width: totalMainWidth,
    height: supportY + regions.at(-1)!.height,
    columns,
    levels,
    regions,
    nodes,
    edges,
    routes,
  };
}
