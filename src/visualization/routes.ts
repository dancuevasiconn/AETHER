import type { GraphEngine, GraphNode } from "../graph/index.js";
import { read, reference } from "./common.js";
import type { EntityReference, FlowRoute } from "./types.js";

export function buildRoute(graph: GraphEngine, flow: GraphNode): FlowRoute {
  const membership = read(graph.getOutgoing(flow.key, { edgeTypes: ["Flow.segment"] }));
  return {
    flow: reference(flow),
    graphNodeKey: flow.key,
    visibility: "HIDDEN",
    segments: read(graph.getFlowSegments(flow.key)).map((segment) => {
      const node = read(graph.getNode("FlowSegment", segment.id));
      const ref = (entityType: EntityReference["entityType"], entityId: string): EntityReference =>
        reference(read(graph.getNode(entityType, entityId)));
      const segmentEdges = read(graph.getOutgoing(node.key));
      return {
        reference: reference(node),
        graphNodeKey: node.key,
        flow: reference(flow),
        sequence: segment.sequence,
        source: ref("Element", segment.sourceElementId),
        target: ref("Element", segment.targetElementId),
        dataObjects: [...new Set(segment.dataObjectIds)].sort().map((id) => ref("DataObject", id)),
        ...(segment.relationshipId
          ? { relationship: ref("Relationship", segment.relationshipId) }
          : {}),
        graphEdgeKeys: [
          ...new Set(
            [...membership.filter((e) => e.target === node.key), ...segmentEdges].map((e) => e.key),
          ),
        ].sort(),
      };
    }),
  };
}
export function routeReferences(route: FlowRoute): EntityReference[] {
  return [
    route.flow,
    ...route.segments.flatMap((s) => [
      s.reference,
      s.source,
      s.target,
      ...s.dataObjects,
      ...(s.relationship ? [s.relationship] : []),
    ]),
  ];
}
