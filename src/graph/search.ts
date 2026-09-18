import { collections, compareEdges, ordinal } from "./projection.js";
import {
  EDGE_TYPES,
  type EdgeOptions,
  type GraphResult,
  type GraphStep,
  type NeighborOptions,
  type NodeKey,
  type SearchOptions,
} from "./types.js";
import type { Indexes } from "./indexes.js";

const kinds = new Set<string>(["Architecture", ...collections.map(([, kind]) => kind)]);
export function failure(
  code: "NODE_NOT_FOUND" | "INVALID_PARAMETERS" | "INTERNAL_ERROR",
  message: string,
): GraphResult<never> {
  return { success: false, error: { code, message } };
}
export function checkOptions(options: NeighborOptions, search = false): GraphResult<true> {
  if (typeof options !== "object" || options === null)
    return failure("INVALID_PARAMETERS", "Options must be an object.");
  if (
    options.direction !== undefined &&
    !["outgoing", "incoming", "both"].includes(options.direction)
  )
    return failure("INVALID_PARAMETERS", "Invalid direction.");
  if (
    options.edgeTypes !== undefined &&
    (!Array.isArray(options.edgeTypes) ||
      !options.edgeTypes.every(
        (t: unknown) => typeof t === "string" && EDGE_TYPES.some((known) => known === t),
      ))
  )
    return failure("INVALID_PARAMETERS", "Invalid edgeTypes.");
  if (search) {
    if (
      !("maxDepth" in options) ||
      typeof options.maxDepth !== "number" ||
      !Number.isInteger(options.maxDepth) ||
      !Number.isFinite(options.maxDepth) ||
      options.maxDepth < 0
    )
      return failure("INVALID_PARAMETERS", "maxDepth must be a finite integer >= 0.");
    const raw = options as unknown as Record<string, unknown>;
    for (const field of ["expansionEntityTypes", "resultEntityTypes"] as const) {
      if (raw[field] !== undefined) {
        const values: unknown = raw[field];
        if (
          !Array.isArray(values) ||
          !values.every((value: unknown) => typeof value === "string" && kinds.has(value))
        )
          return failure("INVALID_PARAMETERS", `Invalid ${field}.`);
      }
    }
    if (
      "includeStart" in options &&
      options.includeStart !== undefined &&
      typeof options.includeStart !== "boolean"
    )
      return failure("INVALID_PARAMETERS", "includeStart must be boolean.");
  }
  return { success: true, value: true };
}
export function allowedEdge(edgeType: string, options: EdgeOptions): boolean {
  return options.edgeTypes === undefined || options.edgeTypes.some((type) => type === edgeType);
}
export function steps(index: Indexes, key: NodeKey, options: NeighborOptions): GraphStep[] {
  const result: GraphStep[] = [];
  const direction = options.direction ?? "outgoing";
  if (direction !== "incoming")
    for (const edge of index.outgoingEdges.get(key) ?? [])
      if (allowedEdge(edge.edgeType, options))
        result.push({ edge, from: key, to: edge.target, direction: "forward" });
  if (direction !== "outgoing")
    for (const edge of index.incomingEdges.get(key) ?? [])
      if (allowedEdge(edge.edgeType, options))
        result.push({ edge, from: key, to: edge.source, direction: "inverse" });
  return result.sort(
    (x, y) =>
      compareEdges(x.edge, y.edge) || ordinal(x.to, y.to) || ordinal(x.direction, y.direction),
  );
}
export interface SearchState {
  readonly depths: ReadonlyMap<NodeKey, number>;
  readonly parents: ReadonlyMap<NodeKey, GraphStep>;
  readonly steps: readonly GraphStep[];
  readonly truncated: boolean;
}
export function search(
  index: Indexes,
  start: NodeKey,
  options: SearchOptions,
): GraphResult<SearchState> {
  const checked = checkOptions(options, true);
  if (!checked.success) return checked;
  if (!index.nodeByKey.has(start)) return failure("NODE_NOT_FOUND", "Start node does not exist.");
  const depths = new Map<NodeKey, number>([[start, 0]]);
  const parents = new Map<NodeKey, GraphStep>();
  const queue: NodeKey[] = [start];
  const traversed: GraphStep[] = [];
  function canExpand(key: NodeKey): boolean {
    return (
      key === start ||
      options.expansionEntityTypes === undefined ||
      options.expansionEntityTypes.some((kind) => kind === index.nodeByKey.get(key)?.entityType)
    );
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    const depth = depths.get(current)!;
    if (depth >= options.maxDepth || !canExpand(current)) continue;
    for (const step of steps(index, current, options)) {
      traversed.push(step);
      if (depths.has(step.to)) continue;
      depths.set(step.to, depth + 1);
      parents.set(step.to, step);
      queue.push(step.to);
    }
  }
  const truncated = queue.some(
    (key) =>
      depths.get(key) === options.maxDepth &&
      canExpand(key) &&
      steps(index, key, options).some((step) => !depths.has(step.to)),
  );
  return { success: true, value: { depths, parents, steps: traversed, truncated } };
}
