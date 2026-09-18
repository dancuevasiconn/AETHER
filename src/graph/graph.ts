import type { Architecture, EntityKind, FlowSegment } from "../domain/index.js";
import { validateArchitecture } from "../validation/index.js";
import { indexProjection, positioningKey, type Indexes } from "./indexes.js";
import { compareEdges, nodeKey, ordinal, project } from "./projection.js";
import { allowedEdge, checkOptions, failure, search, steps } from "./search.js";
import type {
  ContextOptions,
  EdgeOptions,
  GraphEngine,
  GraphNode,
  GraphResult,
  GraphStep,
  GraphVisit,
  NeighborOptions,
  NodeKey,
  PathResult,
  SearchOptions,
  TraversalOptions,
  TraversalResult,
} from "./types.js";

function api(index: Indexes): GraphEngine {
  function exists(key: NodeKey): GraphResult<GraphNode> {
    const node = index.nodeByKey.get(key);
    return node
      ? { success: true, value: node }
      : failure("NODE_NOT_FOUND", "Node does not exist.");
  }
  function edges(key: NodeKey, direction: "incoming" | "outgoing", options: EdgeOptions = {}) {
    const checked = checkOptions(options);
    if (!checked.success) return checked;
    const found = exists(key);
    if (!found.success) return found;
    return {
      success: true as const,
      value: [
        ...((direction === "outgoing" ? index.outgoingEdges : index.incomingEdges).get(key) ?? []),
      ].filter((edge) => allowedEdge(edge.edgeType, options)),
    };
  }
  function visits(
    state: ReadonlyMap<NodeKey, number>,
    start: NodeKey,
    options: TraversalOptions,
  ): GraphVisit[] {
    return [...state]
      .filter(
        ([key]) =>
          (options.includeStart !== false || key !== start) &&
          (options.resultEntityTypes === undefined ||
            options.resultEntityTypes.some(
              (kind) => kind === index.nodeByKey.get(key)?.entityType,
            )),
      )
      .map(([key, depth]) => ({ node: index.nodeByKey.get(key)!, depth }))
      .sort((x, y) => x.depth - y.depth || ordinal(x.node.key, y.node.key));
  }
  function traverse(key: NodeKey, options: TraversalOptions): GraphResult<TraversalResult> {
    const result = search(index, key, options);
    if (!result.success) return result;
    const reached = visits(result.value.depths, key, options);
    return {
      success: true,
      value: {
        nodes: reached.map((visit) => visit.node),
        visits: reached,
        steps: result.value.steps,
      },
    };
  }
  function path(source: NodeKey, target: NodeKey, options: SearchOptions): GraphResult<PathResult> {
    const found = exists(target);
    if (!found.success) return found;
    const result = search(index, source, options);
    if (!result.success) return result;
    if (!result.value.depths.has(target))
      return {
        success: true,
        value: { status: result.value.truncated ? "depth-limit-reached" : "not-found" },
      };
    const route: GraphStep[] = [];
    let current = target;
    while (current !== source) {
      const parent = result.value.parents.get(current);
      if (!parent) return failure("INTERNAL_ERROR", "Path predecessor missing.");
      route.push(parent);
      current = parent.from;
    }
    route.reverse();
    return {
      success: true,
      value: {
        status: "found",
        nodes: [
          index.nodeByKey.get(source)!,
          ...route.map((step) => index.nodeByKey.get(step.to)!),
        ],
        edges: route.map((step) => step.edge),
        steps: route,
      },
    };
  }
  function context(key: NodeKey, options: ContextOptions) {
    if (typeof options !== "object" || options === null || options.direction === undefined)
      return failure("INVALID_PARAMETERS", "Context requires direction.");
    const result = search(index, key, options);
    if (!result.success) return result;
    const reached = visits(result.value.depths, key, { ...options, includeStart: true });
    const focus = index.nodeByKey.get(key)!;
    // Focus is explicit even when the result filter requests other entity types.
    if (!reached.some((visit) => visit.node.key === key))
      reached.unshift({ node: focus, depth: 0 });
    const keys = new Set(reached.map((visit) => visit.node.key));
    const included = index.projection.edges.filter(
      (edge) =>
        keys.has(edge.source) && keys.has(edge.target) && allowedEdge(edge.edgeType, options),
    );
    return {
      success: true as const,
      value: { focus, nodes: reached.map((visit) => visit.node), visits: reached, edges: included },
    };
  }
  return Object.freeze({
    getNode: (type: EntityKind, id: string) => exists(nodeKey(type, id)),
    getEntity: (key: NodeKey) => {
      const found = exists(key);
      if (!found.success) return found;
      const entity = index.projection.entities.get(key);
      if (!entity) return failure("INTERNAL_ERROR", "Snapshot entity missing.");
      return { success: true as const, value: structuredClone(entity) };
    },
    getNodesByType: (type: EntityKind) => [...(index.nodesByType.get(type) ?? [])],
    getNodesByLayer: (key, role) => {
      const found = exists(key);
      if (!found.success) return found;
      if (found.value.entityType !== "Layer")
        return failure("INVALID_PARAMETERS", "Expected Layer key.");
      if (!["DIRECT", "LOGICAL", "ACTUAL"].includes(role))
        return failure("INVALID_PARAMETERS", "Invalid positioning role.");
      return {
        success: true as const,
        value: [...(index.nodesByLayer.get(positioningKey(role, key)) ?? [])],
      };
    },
    getNodesByArchitectureLevel: (level, role) =>
      (role ? [role] : (["DIRECT", "ACTUAL"] as const))
        .flatMap((r) => [...(index.nodesByArchitectureLevel.get(positioningKey(r, level)) ?? [])])
        .sort((x, y) => ordinal(x.key, y.key)),
    getNodesByApsLayer: (aps, role) =>
      (role ? [role] : (["DIRECT", "LOGICAL", "ACTUAL"] as const))
        .flatMap((r) => [...(index.nodesByApsLayer.get(positioningKey(r, aps)) ?? [])])
        .sort((x, y) => ordinal(x.key, y.key)),
    getLayersByApsLayer: (aps) => [...(index.layersByApsLayer.get(aps) ?? [])],
    getOutgoing: (key, options) => edges(key, "outgoing", options),
    getIncoming: (key, options) => edges(key, "incoming", options),
    getNeighbors: (key: NodeKey, options: NeighborOptions = {}) => {
      const checked = checkOptions(options);
      if (!checked.success) return checked;
      const found = exists(key);
      if (!found.success) return found;
      const traversed = steps(index, key, options);
      const keys = [...new Set(traversed.map((step) => step.to))].sort(ordinal);
      const edgeKeys = [...new Set(traversed.map((step) => step.edge.key))];
      return {
        success: true as const,
        value: {
          nodes: keys.map((k) => index.nodeByKey.get(k)!),
          edges: edgeKeys.map((k) => index.edgeByKey.get(k)!).sort(compareEdges),
          steps: traversed,
        },
      };
    },
    traverse,
    findPath: path,
    getContext: context,
    getFlowSegments: (key: NodeKey) => {
      const found = exists(key);
      if (!found.success) return found;
      if (found.value.entityType !== "Flow")
        return failure("INVALID_PARAMETERS", "Expected Flow key.");
      const entity = index.projection.entities.get(key);
      if (!entity || !("startElementId" in entity))
        return failure("INTERNAL_ERROR", "Flow snapshot missing.");
      const segments: FlowSegment[] = [];
      for (const id of entity.flowSegmentIds) {
        const segment = index.projection.entities.get(nodeKey("FlowSegment", id));
        if (!segment || !("sequence" in segment))
          return failure("INTERNAL_ERROR", "FlowSegment snapshot missing.");
        segments.push(structuredClone(segment));
      }
      return {
        success: true as const,
        value: segments.sort((x, y) => x.sequence - y.sequence || ordinal(x.id, y.id)),
      };
    },
  } satisfies GraphEngine);
}

export function createGraph(architecture: Architecture): GraphResult<GraphEngine> {
  const checked = validateArchitecture(architecture);
  if (!checked.valid)
    return {
      success: false,
      error: {
        code: "INVALID_ARCHITECTURE",
        message: "Architecture failed Domain Validator.",
        errors: checked.errors,
      },
    };
  try {
    // This private clone never escapes: entity queries return their own clones.
    const snapshot = structuredClone(architecture);
    return { success: true, value: api(indexProjection(snapshot, project(snapshot))) };
  } catch {
    return failure("INTERNAL_ERROR", "Unexpected failure creating graph snapshot or projection.");
  }
}
