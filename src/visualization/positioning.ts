import { APS_LAYERS } from "../domain/index.js";
import type { GraphEngine, GraphNode, PositioningRole } from "../graph/index.js";
import { read, reference } from "./common.js";
import type { PositionEvidence, SemanticPosition } from "./types.js";

export function position(graph: GraphEngine, node: GraphNode): SemanticPosition {
  const kind = node.entityType;
  const role: PositioningRole | undefined =
    kind === "Element"
      ? "DIRECT"
      : kind === "BusinessRule"
        ? "LOGICAL"
        : kind === "RuleImplementation"
          ? "ACTUAL"
          : undefined;
  const provenance: PositionEvidence[] = [];
  if (kind === "Process" || kind === "Role" || kind === "BusinessCapability")
    return {
      presentationLevel: "BUSINESS",
      provenance: [
        {
          property: "presentationLevel",
          source: "VISUAL_RULE",
          rule: `${kind}.businessPresentation`,
        },
      ],
      positioningState: "PARTIALLY_POSITIONED",
    };
  if (!role) return { provenance, positioningState: "NOT_APPLICABLE" };
  const edgeType =
    kind === "Element"
      ? "Element.layer"
      : kind === "BusinessRule"
        ? "BusinessRule.logicalLayer"
        : "RuleImplementation.actualLayer";
  const layerEdge = read(graph.getOutgoing(node.key, { edgeTypes: [edgeType] }))[0];
  const layerNode = layerEdge
    ? read(graph.getNeighbors(node.key, { edgeTypes: [edgeType] })).nodes[0]
    : undefined;
  const apsLayer = APS_LAYERS.find((aps) =>
    graph.getNodesByApsLayer(aps, role).some((n) => n.key === node.key),
  );
  const entity = read(graph.getEntity(node.key));
  const architectureLevel = "architectureLevel" in entity ? entity.architectureLevel : undefined;
  if (layerNode)
    provenance.push({
      property: "layer",
      source: "DOMAIN_FIELD",
      entity: node.key,
      field:
        kind === "Element"
          ? "layerId"
          : kind === "BusinessRule"
            ? "logicalLayerId"
            : "actualLayerId",
    });
  if (apsLayer)
    provenance.push({
      property: "apsLayer",
      source: "GRAPH_APS_INHERITANCE",
      ...(layerNode ? { entity: layerNode.key } : {}),
    });
  if (architectureLevel)
    provenance.push({
      property: "architectureLevel",
      source: "DOMAIN_FIELD",
      entity: node.key,
      field: "architectureLevel",
    });
  return {
    positioningRole: role,
    ...(layerNode ? { layer: reference(layerNode) } : {}),
    ...(apsLayer ? { apsLayer } : {}),
    ...(architectureLevel ? { architectureLevel } : {}),
    provenance,
    positioningState:
      apsLayer && architectureLevel
        ? "POSITIONED"
        : apsLayer || architectureLevel
          ? "PARTIALLY_POSITIONED"
          : "UNPOSITIONED",
  };
}
