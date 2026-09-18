import type { ContextOptions, GraphEngine, GraphNode } from "../graph/index.js";
import { entityKinds, fail, read } from "./common.js";
import { buildRoute, routeReferences } from "./routes.js";
import { defaultContext } from "./rules.js";
import { resolve } from "./view-state.js";
import type { FlowRoute, ViewState } from "./types.js";

export interface Candidates {
  readonly nodes: Map<string, GraphNode>;
  readonly related: Set<string>;
  readonly orientation: Set<string>;
  readonly revealed: Set<string>;
  readonly depths: Map<string, number>;
  readonly routes: FlowRoute[];
  readonly primaryData: Set<string>;
  readonly context: ContextOptions | undefined;
}
export function collect(graph: GraphEngine, state: ViewState): Candidates {
  const nodes = new Map<string, GraphNode>();
  const related = new Set<string>();
  const orientation = new Set<string>();
  const revealed = new Set<string>();
  const depths = new Map<string, number>();
  const routes: FlowRoute[] = [];
  const primaryData = new Set<string>();
  const add = (node: GraphNode, isRelated = true): void => {
    nodes.set(node.key, node);
    if (isRelated) related.add(node.key);
  };
  const focus = state.focus ? resolve(graph, state.focus) : undefined;
  const context =
    state.viewType === "FOCUS" || state.viewType === "FLOW_FAMILY"
      ? { ...defaultContext(state.viewType), ...state.context }
      : undefined;
  if (state.viewType === "FULL_MAP")
    for (const kind of entityKinds) for (const node of graph.getNodesByType(kind)) add(node);
  else if (context && focus) {
    const result = read(graph.getContext(focus.key, context));
    for (const node of result.nodes) add(node);
    for (const visit of result.visits) depths.set(visit.node.key, visit.depth);
  } else if (focus) add(focus);
  if (state.viewType === "FOCUS" || state.viewType === "FLOW_FAMILY")
    for (const ref of state.orientationBase ?? []) {
      const node = resolve(graph, ref);
      add(node, false);
      orientation.add(node.key);
    }
  function route(flow: GraphNode): void {
    if (routes.some((r) => r.graphNodeKey === flow.key)) return;
    const descriptor = buildRoute(graph, flow);
    routes.push(descriptor);
    for (const ref of routeReferences(descriptor)) add(resolve(graph, ref));
    for (const edge of read(graph.getOutgoing(flow.key, { edgeTypes: ["Flow.dataObject"] }))) {
      add(
        read(graph.getNeighbors(flow.key, { edgeTypes: ["Flow.dataObject"] })).nodes.find(
          (n) => n.key === edge.target,
        )!,
      );
      if (state.viewType === "FLOW" || state.activeRoute?.entityId === flow.entityId)
        primaryData.add(edge.target);
    }
    for (const node of read(
      graph.getNeighbors(flow.key, {
        direction: "both",
        edgeTypes: [
          "Flow.flowFamily",
          "Process.initiatesFlow",
          "Process.usesFlow",
          "Role.flow",
          "BusinessRule.flow",
        ],
      }),
    ).nodes)
      add(node);
  }
  if (focus?.entityType === "Flow" && (state.viewType === "FLOW" || state.viewType === "FOCUS"))
    route(focus);
  if (state.viewType === "FLOW_FAMILY" && focus)
    for (const node of read(
      graph.getNeighbors(focus.key, { direction: "incoming", edgeTypes: ["Flow.flowFamily"] }),
    ).nodes) {
      // Only flows recovered within the explicit bounded context get a route.
      if (nodes.has(node.key)) route(node);
    }
  if (state.activeRoute) {
    const flow = resolve(graph, state.activeRoute);
    if (
      state.viewType === "FLOW_FAMILY" &&
      focus &&
      !read(graph.getOutgoing(flow.key, { edgeTypes: ["Flow.flowFamily"] })).some(
        (e) => e.target === focus.key,
      )
    )
      fail("INVALID_ACTIVE_ROUTE", "Route does not belong to focal FlowFamily.");
    route(flow);
  }
  if (state.viewType === "FOCUS" && focus?.entityType === "Process")
    for (const edge of read(graph.getOutgoing(focus.key, { edgeTypes: ["Process.dataObject"] })))
      primaryData.add(edge.target);
  for (const expansion of state.expansions ?? []) {
    const node = resolve(graph, expansion);
    if (!nodes.has(node.key))
      fail("INVALID_REFERENCE", "Expansion must identify a recovered entity.");
    revealed.add(node.key);
    const neighbors = read(
      graph.getNeighbors(node.key, {
        direction: "both",
        ...(context?.edgeTypes ? { edgeTypes: context.edgeTypes } : {}),
      }),
    );
    for (const neighbor of neighbors.nodes) {
      add(neighbor);
      revealed.add(neighbor.key);
    }
  }
  if (focus) add(focus);
  return { nodes, related, orientation, revealed, depths, routes, primaryData, context };
}
