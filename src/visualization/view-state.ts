import { APS_LAYERS } from "../domain/index.js";
import { EDGE_TYPES } from "../graph/index.js";
import type { GraphEngine, GraphNode } from "../graph/index.js";
import { entityKinds, fail, levels, ordinal } from "./common.js";
import type { EntityReference, ViewState, VisualizationErrorCode } from "./types.js";

function isReference(input: unknown): input is EntityReference {
  if (typeof input !== "object" || input === null) return false;
  return (
    "entityType" in input &&
    typeof input.entityType === "string" &&
    entityKinds.some((kind) => kind === input.entityType) &&
    "entityId" in input &&
    typeof input.entityId === "string" &&
    input.entityId.length > 0
  );
}
export function resolve(
  graph: GraphEngine,
  input: unknown,
  code: VisualizationErrorCode = "INVALID_REFERENCE",
): GraphNode {
  if (!isReference(input)) fail(code, "Expected canonical entity reference.");
  const result = graph.getNode(input.entityType, input.entityId);
  if (!result.success) fail(code, "Referenced entity does not exist in graph snapshot.");
  return result.value;
}
function list(input: unknown, allowed: readonly string[], code: VisualizationErrorCode): void {
  if (
    !Array.isArray(input) ||
    !input.every((v: unknown) => typeof v === "string" && allowed.includes(v))
  )
    fail(code, "Invalid filter or context values.");
}
function references(
  graph: GraphEngine,
  input: unknown,
  kind?: string,
  code: VisualizationErrorCode = "INVALID_REFERENCE",
): void {
  if (!Array.isArray(input)) fail(code, "Expected reference list.");
  for (const item of input as unknown[]) {
    const node = resolve(graph, item, code);
    if (kind && node.entityType !== kind) fail(code, `Expected ${kind} reference.`);
  }
}
function canonical(input: unknown): unknown {
  if (Array.isArray(input)) {
    const unique = new Map<string, unknown>();
    for (const item of input as unknown[]) {
      const value = canonical(item);
      unique.set(JSON.stringify(value), value);
    }
    return [...unique].sort(([a], [b]) => ordinal(a, b)).map(([, value]) => value);
  }
  if (typeof input === "object" && input !== null)
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => ordinal(a, b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return input;
}
export function normalizeState(graph: GraphEngine, state: ViewState): ViewState {
  if (typeof state !== "object" || state === null)
    fail("INVALID_PARAMETERS", "View State must be an object.");
  if (
    Object.keys(state).some(
      (field) =>
        ![
          "viewId",
          "viewType",
          "focus",
          "selection",
          "filters",
          "expansions",
          "orientationBase",
          "activeRoute",
          "context",
        ].includes(field),
    )
  )
    fail("INVALID_PARAMETERS", "Unknown View State field.");
  if (!["FULL_MAP", "FOCUS", "FLOW", "FLOW_FAMILY"].includes(state.viewType))
    fail("INVALID_VIEW_TYPE", "Unsupported perspective.");
  if (typeof state.viewId !== "string" || state.viewId.trim().length === 0)
    fail("INVALID_PARAMETERS", "Caller must supply viewId.");
  if (state.viewType !== "FULL_MAP" && state.focus === undefined)
    fail("FOCUS_REQUIRED", "This perspective requires focus.");
  if (state.focus !== undefined) {
    if (!isReference(state.focus)) fail("FOCUS_NOT_FOUND", "Invalid focus reference.");
    if (
      (state.viewType === "FLOW" && state.focus.entityType !== "Flow") ||
      (state.viewType === "FLOW_FAMILY" && state.focus.entityType !== "FlowFamily")
    )
      fail("INVALID_FOCUS_TYPE", "Focus type does not match perspective.");
    resolve(graph, state.focus, "FOCUS_NOT_FOUND");
  }
  if (state.selection !== undefined) resolve(graph, state.selection, "INVALID_SELECTION");
  if (state.expansions !== undefined) references(graph, state.expansions);
  if (state.orientationBase !== undefined) references(graph, state.orientationBase);
  if (state.activeRoute !== undefined) {
    if (resolve(graph, state.activeRoute, "INVALID_ACTIVE_ROUTE").entityType !== "Flow")
      fail("INVALID_ACTIVE_ROUTE", "Active route must identify Flow.");
    if (state.viewType === "FLOW" && state.activeRoute.entityId !== state.focus?.entityId)
      fail("INVALID_ACTIVE_ROUTE", "Active route conflicts with focal Flow.");
  }
  if (state.filters !== undefined) {
    if (typeof state.filters !== "object" || state.filters === null)
      fail("INVALID_FILTERS", "Filters must be an object.");
    const raw = state.filters as unknown as Record<string, unknown>;
    const allowed = [
      "entityTypes",
      "apsLayers",
      "architectureLevels",
      "flowFamilies",
      "edgeTypes",
      "positioningRoles",
      "layers",
      "elementTypes",
    ];
    if (Object.keys(raw).some((k) => !allowed.includes(k)))
      fail("INVALID_FILTERS", "Unknown filter.");
    const catalog = {
      entityTypes: entityKinds,
      apsLayers: APS_LAYERS,
      architectureLevels: levels,
      edgeTypes: EDGE_TYPES,
      positioningRoles: ["DIRECT", "LOGICAL", "ACTUAL"],
    };
    for (const [field, values] of Object.entries(catalog))
      if (raw[field] !== undefined) list(raw[field], values, "INVALID_FILTERS");
    if (
      raw.elementTypes !== undefined &&
      (!Array.isArray(raw.elementTypes) ||
        !raw.elementTypes.every((v: unknown) => typeof v === "string" && v.length > 0))
    )
      fail("INVALID_FILTERS", "Invalid elementTypes.");
    if (raw.layers !== undefined) references(graph, raw.layers, "Layer", "INVALID_FILTERS");
    if (raw.flowFamilies !== undefined)
      references(graph, raw.flowFamilies, "FlowFamily", "INVALID_FILTERS");
  }
  if (state.context !== undefined) {
    if (state.viewType === "FULL_MAP" || state.viewType === "FLOW")
      fail("INVALID_CONTEXT", "Context overrides apply only to FOCUS and FLOW_FAMILY.");
    if (typeof state.context !== "object" || state.context === null)
      fail("INVALID_CONTEXT", "Context must be an object.");
    if (
      Object.keys(state.context).some(
        (field) => !["maxDepth", "direction", "edgeTypes", "expansionEntityTypes"].includes(field),
      )
    )
      fail("INVALID_CONTEXT", "Unknown context parameter.");
    if (
      !Number.isFinite(state.context.maxDepth) ||
      !Number.isInteger(state.context.maxDepth) ||
      state.context.maxDepth < 0
    )
      fail("INVALID_CONTEXT", "maxDepth must be finite integer >= 0.");
    if (!["incoming", "outgoing", "both"].includes(state.context.direction))
      fail("INVALID_CONTEXT", "Invalid direction.");
    if (state.context.edgeTypes !== undefined)
      list(state.context.edgeTypes, EDGE_TYPES, "INVALID_CONTEXT");
    if (state.context.expansionEntityTypes !== undefined)
      list(state.context.expansionEntityTypes, entityKinds, "INVALID_CONTEXT");
  }
  // References are normalized to identity only: no parallel entity payload enters the projection.
  const identity = (ref: EntityReference): EntityReference => ({
    entityType: ref.entityType,
    entityId: ref.entityId,
  });
  return canonical({
    ...state,
    ...(state.focus ? { focus: identity(state.focus) } : {}),
    ...(state.selection ? { selection: identity(state.selection) } : {}),
    ...(state.activeRoute ? { activeRoute: identity(state.activeRoute) } : {}),
    ...(state.expansions ? { expansions: state.expansions.map(identity) } : {}),
    ...(state.orientationBase ? { orientationBase: state.orientationBase.map(identity) } : {}),
    ...(state.filters
      ? {
          filters: {
            ...state.filters,
            ...(state.filters.layers ? { layers: state.filters.layers.map(identity) } : {}),
            ...(state.filters.flowFamilies
              ? { flowFamilies: state.filters.flowFamilies.map(identity) }
              : {}),
          },
        }
      : {}),
  }) as ViewState;
}
