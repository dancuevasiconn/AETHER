import type { FlowSegment } from "../domain/index.js";
import type { GraphNode } from "../graph/index.js";
import type {
  EntityReference,
  ViewState,
  ViewType,
  VisualizationProjection,
} from "../visualization/index.js";
import type {
  FilterPolicy,
  NavigationAvailability,
  NavigationBreadcrumb,
  NavigationEntry,
  NavigationErrorCode,
  NavigationGraph,
  NavigationIntent,
  NavigationOption,
  NavigationOptionsResult,
  NavigationResult,
  NavigationState,
  NavigationTarget,
  NavigationTransition,
} from "./types.js";

const ref = (node: GraphNode): EntityReference => ({
  entityType: node.entityType,
  entityId: node.entityId,
});
const keyOf = (value: EntityReference) => `${value.entityType}:${value.entityId}`;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null)
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function idFor(
  state: NavigationState | undefined,
  intent: NavigationIntent | "INITIAL",
  viewState: ViewState,
): string {
  const raw = canonical({
    position: state ? state.past.length + state.future.length + 1 : 0,
    intent,
    viewState,
  });
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `nav-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
const fail = (
  state: NavigationState,
  code: NavigationErrorCode,
  message: string,
): NavigationResult => ({ status: "failure", error: { code, message }, state });
const noop = (
  state: NavigationState,
  reason: Extract<NavigationResult, { status: "no-op" }>["reason"],
): NavigationResult => ({ status: "no-op", reason, state });
function resolve(
  graph: NavigationGraph,
  state: NavigationState,
  target: NavigationTarget,
  code: NavigationErrorCode = "TARGET_NOT_FOUND",
): GraphNode | NavigationResult {
  if (!target || !target.reference)
    return fail(state, code, "Navigation target requires an EntityReference.");
  const found = graph.getNode(target.reference.entityType, target.reference.entityId);
  if (!found.success)
    return fail(state, code, "Navigation target does not exist in the graph snapshot.");
  if (target.nodeKey !== undefined && target.nodeKey !== found.value.key)
    return fail(
      state,
      "INVALID_TARGET_TYPE",
      "nodeKey conflicts with the authoritative EntityReference.",
    );
  return found.value;
}
function contextValid(context: NonNullable<ViewState["context"]>): boolean {
  return (
    Number.isFinite(context.maxDepth) &&
    Number.isInteger(context.maxDepth) &&
    context.maxDepth >= 0 &&
    ["incoming", "outgoing", "both"].includes(context.direction)
  );
}
function without<K extends keyof ViewState>(
  state: ViewState,
  ...keys: readonly K[]
): Omit<ViewState, K> {
  const copy = { ...state };
  for (const key of keys) Reflect.deleteProperty(copy, key);
  return copy;
}
function baseState(current: ViewState, policy: FilterPolicy | undefined): ViewState {
  const result = without(current, "selection", "context", "expansions", "activeRoute");
  if (policy === "CLEAR_ALL") return without(result, "filters");
  return result;
}
function perspective(target: NavigationTarget): ViewType {
  return (
    target.perspective ??
    (target.reference.entityType === "Flow"
      ? "FLOW"
      : target.reference.entityType === "FlowFamily"
        ? "FLOW_FAMILY"
        : "FOCUS")
  );
}
function compatible(target: NavigationTarget, expected: ViewType): boolean {
  return target.perspective === undefined || target.perspective === expected;
}
function label(target: NavigationTarget | undefined): string {
  return target
    ? `${target.reference.entityType} ${target.reference.entityId}`
    : "Architecture Overview";
}
function entry(
  state: NavigationState,
  intent: NavigationIntent,
  viewState: ViewState,
  target?: NavigationTarget,
  transition?: NavigationEntry["transition"],
): NavigationEntry {
  return {
    id: idFor(state, intent, viewState),
    intentType: intent.type,
    ...(target ? { target } : {}),
    viewState,
    ...(transition ? { transition } : {}),
    label: label(target),
  };
}
function push(state: NavigationState, next: NavigationEntry): NavigationState {
  return { home: state.home, past: [...state.past, state.current], current: next, future: [] };
}
function replace(state: NavigationState, next: NavigationEntry): NavigationState {
  return { ...state, current: next };
}
function success(navigationState: NavigationState): NavigationResult {
  return {
    status: "success",
    transition: {
      navigationState,
      viewState: navigationState.current.viewState,
      entry: navigationState.current,
    },
    warnings: [],
  };
}
function significant(
  state: NavigationState,
  intent: NavigationIntent,
  viewState: ViewState,
  target?: NavigationTarget,
  transition?: NavigationEntry["transition"],
): NavigationResult {
  if (canonical(viewState) === canonical(state.current.viewState))
    return noop(state, "ALREADY_CURRENT");
  return success(push(state, entry(state, intent, viewState, target, transition)));
}
function local(
  state: NavigationState,
  intent: NavigationIntent,
  viewState: ViewState,
  target?: NavigationTarget,
): NavigationResult {
  if (canonical(viewState) === canonical(state.current.viewState))
    return noop(state, "SELECTION_UNCHANGED");
  const updated: { readonly [K in keyof NavigationEntry]: NavigationEntry[K] } = {
    ...state.current,
    intentType: intent.type,
    ...(target ? { target } : {}),
    viewState,
  };
  return success(replace(state, updated));
}
function flowContext(
  graph: NavigationGraph,
  state: NavigationState,
): { flow: GraphNode; segments: readonly FlowSegment[] } | NavigationResult {
  const current = state.current.viewState,
    flowRef =
      current.activeRoute ?? (current.focus?.entityType === "Flow" ? current.focus : undefined);
  if (!flowRef)
    return fail(state, "FLOW_NOT_AVAILABLE", "Flow navigation requires an active Flow.");
  const node = graph.getNode("Flow", flowRef.entityId);
  if (!node.success) return fail(state, "FLOW_NOT_AVAILABLE", "Active Flow is unavailable.");
  const segments = graph.getFlowSegments(node.value.key);
  if (!segments.success) return fail(state, "GRAPH_ERROR", segments.error.message);
  const sorted = [...segments.value].sort(
    (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id),
  );
  if (new Set(sorted.map((segment) => segment.sequence)).size !== sorted.length)
    return fail(state, "FLOW_SEGMENT_NOT_FOUND", "Flow segment sequence is inconsistent.");
  return { flow: node.value, segments: sorted };
}
function chooseSegment(
  graph: NavigationGraph,
  state: NavigationState,
  intent: NavigationIntent,
  delta: number,
): NavigationResult {
  const context = flowContext(graph, state);
  if ("status" in context) return context;
  const selected = state.current.viewState.selection;
  if (!selected || selected.entityType !== "FlowSegment")
    return fail(state, "FLOW_SEGMENT_NOT_FOUND", "A selected FlowSegment is required.");
  const index = context.segments.findIndex((segment) => segment.id === selected.entityId);
  if (index < 0)
    return fail(
      state,
      "FLOW_SEGMENT_NOT_FOUND",
      "Selected FlowSegment does not belong to the active Flow.",
    );
  const next = index + delta;
  if (next < 0) return noop(state, "FIRST_FLOW_SEGMENT");
  if (next >= context.segments.length) return noop(state, "LAST_FLOW_SEGMENT");
  const target: NavigationTarget = {
    reference: { entityType: "FlowSegment", entityId: context.segments[next]!.id },
  };
  return local(state, intent, { ...state.current.viewState, selection: target.reference }, target);
}
function segmentEndpoint(
  graph: NavigationGraph,
  state: NavigationState,
  intent: NavigationIntent,
  field: "sourceElementId" | "targetElementId",
  policy?: FilterPolicy,
): NavigationResult {
  const context = flowContext(graph, state);
  if ("status" in context) return context;
  const selected = state.current.viewState.selection,
    segment = context.segments.find((candidate) => candidate.id === selected?.entityId);
  if (!segment)
    return fail(state, "FLOW_SEGMENT_NOT_FOUND", "A valid selected FlowSegment is required.");
  const target: NavigationTarget = {
    reference: { entityType: "Element", entityId: segment[field] },
  };
  const node = resolve(graph, state, target);
  if ("status" in node) return node;
  const next = {
    ...baseState(state.current.viewState, policy),
    viewType: "FOCUS" as const,
    focus: target.reference,
  };
  return significant(state, intent, next, target);
}

export function createNavigationState(
  viewState: ViewState,
  labelText = "Architecture Overview",
): NavigationState {
  const home: NavigationEntry = {
    id: idFor(undefined, "INITIAL", viewState),
    intentType: "INITIAL",
    viewState,
    label: labelText,
  };
  return { home, past: [], current: home, future: [] };
}

export function planNavigation(
  graph: NavigationGraph,
  state: NavigationState,
  intent: NavigationIntent,
): NavigationResult {
  if (intent.type === "BACK") {
    if (state.past.length === 0) return noop(state, "HISTORY_START");
    const restored = state.past.at(-1)!;
    return success({
      home: state.home,
      past: state.past.slice(0, -1),
      current: restored,
      future: [state.current, ...state.future],
    });
  }
  if (intent.type === "FORWARD") {
    if (state.future.length === 0) return noop(state, "HISTORY_END");
    const restored = state.future[0]!;
    return success({
      home: state.home,
      past: [...state.past, state.current],
      current: restored,
      future: state.future.slice(1),
    });
  }
  if (intent.type === "GO_TO_ENTRY") {
    const timeline = [...state.past, state.current, ...state.future],
      index = timeline.findIndex((item) => item.id === intent.entryId),
      currentIndex = state.past.length;
    if (index < 0) return fail(state, "HISTORY_EMPTY", "Breadcrumb entry is not available.");
    if (index === currentIndex) return noop(state, "ALREADY_CURRENT");
    return success({
      home: state.home,
      past: timeline.slice(0, index),
      current: timeline[index]!,
      future: timeline.slice(index + 1),
    });
  }
  if (intent.type === "HOME") {
    const next: ViewState = { viewId: state.current.viewState.viewId, viewType: "FULL_MAP" };
    return significant(state, intent, next);
  }
  if (intent.type === "INSPECT_ENTITY") {
    if (!intent.target) {
      const cleared = without(state.current.viewState, "selection");
      return local(state, intent, cleared);
    }
    const node = resolve(graph, state, intent.target);
    if ("status" in node) return node;
    return local(
      state,
      intent,
      { ...state.current.viewState, selection: intent.target.reference },
      intent.target,
    );
  }
  if (intent.type === "NEXT_FLOW_SEGMENT") return chooseSegment(graph, state, intent, 1);
  if (intent.type === "PREVIOUS_FLOW_SEGMENT") return chooseSegment(graph, state, intent, -1);
  if (intent.type === "OPEN_SEGMENT_SOURCE")
    return segmentEndpoint(graph, state, intent, "sourceElementId", intent.filterPolicy);
  if (intent.type === "OPEN_SEGMENT_TARGET")
    return segmentEndpoint(graph, state, intent, "targetElementId", intent.filterPolicy);
  if (intent.type === "SELECT_FLOW_SEGMENT") {
    const node = resolve(graph, state, intent.target);
    if ("status" in node) return node;
    if (node.entityType !== "FlowSegment")
      return fail(state, "INVALID_TARGET_TYPE", "Expected FlowSegment target.");
    const context = flowContext(graph, state);
    if ("status" in context) return context;
    if (!context.segments.some((segment) => segment.id === node.entityId))
      return fail(state, "FLOW_SEGMENT_NOT_FOUND", "FlowSegment does not belong to active Flow.");
    return local(
      state,
      intent,
      { ...state.current.viewState, selection: intent.target.reference },
      intent.target,
    );
  }
  const target = intent.target,
    node = resolve(
      graph,
      state,
      target,
      intent.type === "OPEN_RELATED" ? "TARGET_NOT_FOUND" : "TARGET_NOT_FOUND",
    );
  if ("status" in node) return node;
  if (intent.type === "OPEN_CONTEXT") {
    if (!compatible(target, "FOCUS"))
      return fail(state, "INVALID_PERSPECTIVE", "Open Context requires FOCUS perspective.");
    if (!contextValid(intent.context))
      return fail(state, "INVALID_CONTEXT", "Invalid context request.");
    return significant(
      state,
      intent,
      {
        ...baseState(state.current.viewState, intent.filterPolicy),
        viewType: "FOCUS",
        focus: target.reference,
        context: intent.context,
      },
      target,
    );
  }
  if (intent.type === "OPEN_FLOW") {
    if (node.entityType !== "Flow")
      return fail(state, "INVALID_TARGET_TYPE", "Open Flow requires Flow target.");
    if (!compatible(target, "FLOW"))
      return fail(state, "INVALID_PERSPECTIVE", "Flow target requires FLOW perspective.");
    return significant(
      state,
      intent,
      {
        ...baseState(state.current.viewState, intent.filterPolicy),
        viewType: "FLOW",
        focus: target.reference,
        activeRoute: target.reference,
      },
      target,
    );
  }
  if (intent.type === "OPEN_FLOW_FAMILY") {
    if (node.entityType !== "FlowFamily")
      return fail(state, "INVALID_TARGET_TYPE", "Open FlowFamily requires FlowFamily target.");
    if (!compatible(target, "FLOW_FAMILY"))
      return fail(
        state,
        "INVALID_PERSPECTIVE",
        "FlowFamily target requires FLOW_FAMILY perspective.",
      );
    return significant(
      state,
      intent,
      {
        ...baseState(state.current.viewState, intent.filterPolicy),
        viewType: "FLOW_FAMILY",
        focus: target.reference,
      },
      target,
    );
  }
  if (intent.type === "FOCUS_ENTITY") {
    if (!compatible(target, "FOCUS"))
      return fail(state, "INVALID_PERSPECTIVE", "Focus Entity requires FOCUS perspective.");
    return significant(
      state,
      intent,
      {
        ...baseState(state.current.viewState, intent.filterPolicy),
        viewType: "FOCUS",
        focus: target.reference,
      },
      target,
    );
  }
  const source = graph.getNode(intent.from.entityType, intent.from.entityId);
  if (!source.success)
    return fail(state, "SOURCE_NOT_FOUND", "Related navigation source does not exist.");
  const neighbors = graph.getNeighbors(source.value.key, { direction: "both" });
  if (!neighbors.success) return fail(state, "GRAPH_ERROR", neighbors.error.message);
  const step = neighbors.value.steps.find(
    (candidate) => candidate.edge.key === intent.viaEdgeKey && candidate.to === node.key,
  );
  if (!step)
    return fail(
      state,
      "RELATION_NOT_FOUND",
      "The supplied edge does not connect source and target.",
    );
  const requested = perspective(target);
  if (target.perspective !== undefined && target.perspective !== requested)
    return fail(state, "INVALID_PERSPECTIVE", "Target perspective is incompatible.");
  const next = {
    ...baseState(state.current.viewState, intent.filterPolicy),
    viewType: requested,
    focus: target.reference,
    ...(requested === "FLOW" ? { activeRoute: target.reference } : {}),
  };
  return significant(state, intent, next, target, {
    from: intent.from,
    edgeKey: step.edge.key,
    edgeType: step.edge.edgeType,
    direction: step.direction,
  });
}

export function assessNavigationProjection(
  result: NavigationResult,
  projection: VisualizationProjection,
): NavigationResult {
  if (result.status !== "success") return result;
  const target = result.transition.entry.target?.reference;
  if (!target) return result;
  const visual = projection.view.nodes.find(
    (node) => node.entityType === target.entityType && node.entityId === target.entityId,
  );
  if (!visual || !visual.focused || visual.visibility !== "HIDDEN") return result;
  return {
    ...result,
    warnings: [
      ...result.warnings,
      { code: "TARGET_FILTERED", message: "Target is valid but excluded by active filters." },
    ],
  };
}
export function commitNavigation(
  _state: NavigationState,
  transition: NavigationTransition,
  effectiveViewState: ViewState,
): NavigationState {
  const current = { ...transition.navigationState.current, viewState: effectiveViewState };
  return {
    ...transition.navigationState,
    current,
    ...(transition.navigationState.home.id === current.id ? { home: current } : {}),
  };
}

export function getNavigationOptions(
  graph: NavigationGraph,
  source: EntityReference,
): NavigationOptionsResult {
  const found = graph.getNode(source.entityType, source.entityId);
  if (!found.success)
    return {
      success: false,
      error: { code: "SOURCE_NOT_FOUND", message: "Navigation source does not exist." },
    };
  const neighbors = graph.getNeighbors(found.value.key, { direction: "both" });
  if (!neighbors.success)
    return { success: false, error: { code: "GRAPH_ERROR", message: neighbors.error.message } };
  const byKey = new Map(neighbors.value.nodes.map((node) => [node.key, node]));
  const options: NavigationOption[] = neighbors.value.steps
    .map((step) => {
      const node = byKey.get(step.to)!,
        targetPerspective: ViewType =
          node.entityType === "Flow"
            ? "FLOW"
            : node.entityType === "FlowFamily"
              ? "FLOW_FAMILY"
              : "FOCUS";
      return {
        target: { reference: ref(node), perspective: targetPerspective },
        edgeKey: step.edge.key,
        edgeType: step.edge.edgeType,
        direction: step.direction,
      };
    })
    .sort(
      (a, b) =>
        a.edgeKey.localeCompare(b.edgeKey) ||
        keyOf(a.target.reference).localeCompare(keyOf(b.target.reference)),
    );
  return { success: true, options };
}
export function getBreadcrumbs(state: NavigationState): readonly NavigationBreadcrumb[] {
  return [...state.past, state.current].map((entry) => ({
    entryId: entry.id,
    label: entry.label ?? label(entry.target),
    current: entry.id === state.current.id,
  }));
}
export function canNavigate(
  graph: NavigationGraph,
  state: NavigationState,
  intent: NavigationIntent,
): NavigationAvailability {
  const result = planNavigation(graph, state, intent);
  return { available: result.status === "success", result };
}
