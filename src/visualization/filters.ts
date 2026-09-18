import type { GraphEngine, GraphNode } from "../graph/index.js";
import { read } from "./common.js";
import { defaultContext } from "./rules.js";
import { resolve } from "./view-state.js";
import type { SemanticPosition, ViewFilters } from "./types.js";

export function familyMembership(
  graph: GraphEngine,
  filters: ViewFilters,
): ReadonlySet<string> | undefined {
  if (filters.flowFamilies === undefined) return undefined;
  const members = new Set<string>();
  for (const family of filters.flowFamilies) {
    const node = resolve(graph, family);
    for (const participant of read(graph.getContext(node.key, defaultContext("FLOW_FAMILY"))).nodes)
      members.add(participant.key);
  }
  return members;
}
export function matches(
  graph: GraphEngine,
  node: GraphNode,
  position: SemanticPosition,
  filters: ViewFilters,
  families: ReadonlySet<string> | undefined,
): boolean {
  const member = <T>(values: readonly T[] | undefined, value: T | undefined): boolean =>
    values === undefined || (value !== undefined && values.includes(value));
  if (
    !member(filters.entityTypes, node.entityType) ||
    !member(filters.apsLayers, position.apsLayer) ||
    !member(filters.architectureLevels, position.architectureLevel) ||
    !member(filters.positioningRoles, position.positioningRole)
  )
    return false;
  if (
    filters.layers !== undefined &&
    !filters.layers.some((layer) => layer.entityId === position.layer?.entityId)
  )
    return false;
  if (families !== undefined && !families.has(node.key)) return false;
  if (filters.elementTypes !== undefined) {
    const entity = read(graph.getEntity(node.key));
    if (!("elementType" in entity) || !filters.elementTypes.includes(entity.elementType))
      return false;
  }
  // Empty edge filter means no results, including nodes; nonempty edge filters select edges only.
  return filters.edgeTypes?.length !== 0;
}
