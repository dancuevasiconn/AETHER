import type { GraphEngine } from "../graph/index.js";
import { attempt, ordinal, read, reference } from "./common.js";
import { label } from "./projection.js";
import { position } from "./positioning.js";
import { buildRoute } from "./routes.js";
import { resolve } from "./view-state.js";
import type {
  EntityReference,
  InformationDescriptor,
  VisualizationResult,
  VisualizationView,
} from "./types.js";

export function getInformationDescriptor(
  graph: GraphEngine,
  view: VisualizationView,
  ref: EntityReference,
): VisualizationResult<InformationDescriptor> {
  return attempt(() => {
    const node = resolve(graph, ref);
    const entity = read(graph.getEntity(node.key));
    const projected = view.nodes.find((n) => n.graphNodeKey === node.key);
    const neighbors = read(graph.getNeighbors(node.key, { direction: "both" }));
    const relations = neighbors.steps.map((step) => ({
      graphEdgeKey: step.edge.key,
      edgeType: step.edge.edgeType,
      source: reference(resolveKey(step.edge.source)),
      target: reference(resolveKey(step.edge.target)),
      direction: step.direction,
      provenance: step.edge.provenance.map((p) => ({ ...p })),
    }));
    function resolveKey(key: string) {
      const found = neighbors.nodes.find((n) => n.key === key);
      return key === node.key ? node : found!;
    }
    const decisions = neighbors.nodes
      .filter(
        (n) =>
          n.entityType === "DecisionReference" &&
          neighbors.edges.some(
            (e) =>
              e.edgeType === "DecisionReference.affectedObject" &&
              e.source === n.key &&
              e.target === node.key,
          ),
      )
      .map(reference);
    const implementations =
      node.entityType === "BusinessRule"
        ? read(
            graph.getNeighbors(node.key, {
              direction: "incoming",
              edgeTypes: ["RuleImplementation.businessRule"],
            }),
          ).nodes.map((implementation) => {
            const details = read(graph.getEntity(implementation.key));
            return {
              reference: reference(implementation),
              semanticPosition: position(graph, implementation),
              implementationType: "implementationType" in details ? details.implementationType : "",
            };
          })
        : [];
    implementations.sort((a, b) => ordinal(a.reference.entityId, b.reference.entityId));
    const specific: Record<string, string | number> = {};
    for (const field of [
      "elementType",
      "relationshipType",
      "implementationType",
      "status",
      "mechanism",
      "sequence",
      "domain",
      "ownership",
      "classification",
      "schemaReference",
      "modelVersion",
      "code",
      "order",
      "reference",
    ]) {
      const data: unknown = (entity as unknown as Record<string, unknown>)[field];
      if (typeof data === "string" || typeof data === "number") specific[field] = data;
    }
    const text = label(graph, node);
    const description = "description" in entity ? entity.description : undefined;
    return {
      reference: reference(node),
      graphNodeKey: node.key,
      ...(text === undefined ? {} : { label: text }),
      ...(description === undefined ? {} : { description }),
      focused: projected?.focused ?? false,
      selected: projected?.selected ?? false,
      semanticPosition: position(graph, node),
      relations,
      specific,
      decisions,
      implementations,
      ...(node.entityType === "Flow" ? { route: buildRoute(graph, node) } : {}),
    };
  });
}
