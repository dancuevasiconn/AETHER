import { APS_LAYERS } from "../domain/index.js";
import type { GraphEngine, GraphNode } from "../graph/index.js";
import { attempt, fail, levels, ordinal, read, reference } from "./common.js";
import { familyMembership, matches } from "./filters.js";
import { collect } from "./perspectives.js";
import { position } from "./positioning.js";
import { baseExposure, primaryEdges, VISUALIZATION_RULES_VERSION } from "./rules.js";
import { routeReferences } from "./routes.js";
import { normalizeState, resolve } from "./view-state.js";
import type {
  Exposure,
  VisualEdge,
  VisualNode,
  ViewState,
  VisualizationProjection,
  VisualizationResult,
} from "./types.js";

export function label(graph: GraphEngine, node: GraphNode): string | undefined {
  const entity = read(graph.getEntity(node.key));
  return "name" in entity ? entity.name : "title" in entity ? entity.title : undefined;
}
export function createVisualization(
  graph: GraphEngine,
  input: ViewState,
): VisualizationResult<VisualizationProjection> {
  return attempt(() => {
    const state = normalizeState(graph, input);
    const candidates = collect(graph, state);
    const filters = state.filters ?? {};
    const families = familyMembership(graph, filters);
    const architecture = graph.getNodesByType("Architecture");
    if (architecture.length !== 1)
      fail("GRAPH_ERROR", "Expected exactly one Architecture in graph snapshot.");
    const focus = state.focus ? resolve(graph, state.focus) : undefined;
    const selected = state.selection ? resolve(graph, state.selection) : undefined;
    const routeKeys = new Set(
      candidates.routes.flatMap((route) =>
        routeReferences(route).map((ref) => resolve(graph, ref).key),
      ),
    );
    let nodes: VisualNode[] = [...candidates.nodes.values()]
      .sort((a, b) => ordinal(a.key, b.key))
      .map((node) => {
        const semanticPosition = position(graph, node);
        const included = matches(graph, node, semanticPosition, filters, families);
        const focused = node.key === focus?.key;
        const primary = candidates.primaryData.has(node.key) || focused;
        const exposure: Exposure = !included
          ? "HIDDEN"
          : primary
            ? "PRIMARY"
            : baseExposure(state.viewType, node.entityType);
        const baseVisible = candidates.orientation.has(node.key);
        const visible =
          included &&
          (exposure === "PRIMARY" ||
            baseVisible ||
            candidates.revealed.has(node.key) ||
            selected?.key === node.key);
        const unrelated = baseVisible && !candidates.related.has(node.key);
        const text = label(graph, node);
        return {
          key: node.key,
          graphNodeKey: node.key,
          entityType: node.entityType,
          entityId: node.entityId,
          ...(text === undefined ? {} : { label: text }),
          exposure,
          visibility: visible ? "VISIBLE" : "HIDDEN",
          emphasis: unrelated
            ? "ATTENUATED"
            : focused ||
                (candidates.related.has(node.key) && state.viewType !== "FULL_MAP") ||
                routeKeys.has(node.key)
              ? "HIGHLIGHTED"
              : "NORMAL",
          semanticPosition,
          selected: false,
          focused,
          representationRole:
            node.entityType === "Architecture" || node.entityType === "FlowFamily"
              ? "CONTEXT"
              : [
                    "Layer",
                    "Position",
                    "Responsibility",
                    "DecisionReference",
                    "FlowSegment",
                  ].includes(node.entityType)
                ? "SUPPORT"
                : "ENTITY",
          ...(candidates.depths.has(node.key) ? { depth: candidates.depths.get(node.key)! } : {}),
        };
      });
    // Visibility is display membership. Hidden candidates cannot retain latent selection.
    const effectiveSelection =
      selected && nodes.some((n) => n.key === selected.key && n.visibility === "VISIBLE")
        ? reference(selected)
        : undefined;
    const selectionCleared = state.selection !== undefined && effectiveSelection === undefined;
    nodes = nodes.map((node) => ({
      ...node,
      selected: effectiveSelection !== undefined && node.key === selected?.key,
      emphasis:
        effectiveSelection !== undefined && node.key === selected?.key
          ? "HIGHLIGHTED"
          : node.emphasis,
    }));
    const nodeByKey = new Map(nodes.map((n) => [n.key, n]));
    const edges: VisualEdge[] = [];
    for (const node of nodes)
      for (const edge of read(graph.getOutgoing(node.graphNodeKey))) {
        const target = nodeByKey.get(edge.target);
        if (!target) continue;
        const permitted =
          filters.edgeTypes === undefined || filters.edgeTypes.includes(edge.edgeType);
        const exposure: Exposure = !permitted
          ? "HIDDEN"
          : primaryEdges.includes(edge.edgeType)
            ? "PRIMARY"
            : "SECONDARY";
        const requested =
          candidates.revealed.has(edge.source) ||
          candidates.revealed.has(edge.target) ||
          node.selected ||
          target.selected;
        const visible =
          permitted &&
          node.visibility === "VISIBLE" &&
          target.visibility === "VISIBLE" &&
          (exposure === "PRIMARY" || requested);
        edges.push({
          graphEdgeKey: edge.key,
          sourceVisualNodeKey: edge.source,
          targetVisualNodeKey: edge.target,
          edgeType: edge.edgeType,
          provenance: edge.provenance.map((p) => ({ ...p })),
          exposure,
          visibility: visible ? "VISIBLE" : "HIDDEN",
          emphasis:
            node.emphasis === "ATTENUATED" || target.emphasis === "ATTENUATED"
              ? "ATTENUATED"
              : node.emphasis === "HIGHLIGHTED" || target.emphasis === "HIGHLIGHTED"
                ? "HIGHLIGHTED"
                : "NORMAL",
        });
      }
    edges.sort((a, b) => ordinal(a.graphEdgeKey, b.graphEdgeKey));
    const routes = candidates.routes
      .sort((a, b) => ordinal(a.graphNodeKey, b.graphNodeKey))
      .map((route) => {
        // Hidden relationship details do not suppress a route; its flow, elements and payloads must pass filters.
        const required = [
          route.flow,
          ...route.segments.flatMap((s) => [s.source, s.target, ...s.dataObjects]),
        ];
        const passes = required.every((ref) => {
          const node = resolve(graph, ref);
          return matches(graph, node, position(graph, node), filters, families);
        });
        const supports = route.segments
          .flatMap((s) => s.graphEdgeKeys)
          .every(
            (edgeKey) =>
              filters.edgeTypes === undefined ||
              edges.some(
                (e) => e.graphEdgeKey === edgeKey && filters.edgeTypes?.includes(e.edgeType),
              ),
          );
        return {
          ...route,
          visibility: passes && supports ? ("VISIBLE" as const) : ("HIDDEN" as const),
        };
      });
    const { selection: unusedSelection, ...rest } = state;
    void unusedSelection;
    const effectiveState: ViewState = {
      ...rest,
      ...(effectiveSelection ? { selection: effectiveSelection } : {}),
    };
    return {
      viewState: effectiveState,
      view: {
        viewId: state.viewId,
        viewType: state.viewType,
        architectureRef: reference(architecture[0]!),
        ...(state.focus ? { focus: state.focus } : {}),
        nodes,
        edges,
        routes,
        activeFilters: filters,
        selectionContext: {
          ...(effectiveSelection ? { selection: effectiveSelection } : {}),
          selectionCleared,
        },
        semanticFrame: { apsLayers: [...APS_LAYERS], architectureLevels: [...levels] },
        projectionMetadata: {
          rulesVersion: VISUALIZATION_RULES_VERSION,
          scope:
            state.viewType === "FULL_MAP"
              ? "ARCHITECTURE"
              : state.viewType === "FLOW"
                ? "FLOW_COMPOSITION"
                : "BOUNDED_CONTEXT",
          context: candidates.context,
          orientationBase: state.orientationBase ?? [],
          expansions: state.expansions ?? [],
          ...(state.activeRoute ? { activeRoute: state.activeRoute } : {}),
          selectionCleared,
        },
      },
    };
  });
}
