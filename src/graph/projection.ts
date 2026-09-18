import type { Architecture, EntityKind } from "../domain/index.js";
import type {
  DomainEntity,
  EdgeProvenance,
  EdgeType,
  GraphEdge,
  GraphNode,
  NodeKey,
} from "./types.js";

export const collections = [
  ["businessCapabilities", "BusinessCapability"],
  ["elements", "Element"],
  ["relationships", "Relationship"],
  ["layers", "Layer"],
  ["processes", "Process"],
  ["dataObjects", "DataObject"],
  ["flows", "Flow"],
  ["flowSegments", "FlowSegment"],
  ["flowFamilies", "FlowFamily"],
  ["roles", "Role"],
  ["positions", "Position"],
  ["responsibilities", "Responsibility"],
  ["businessRules", "BusinessRule"],
  ["ruleImplementations", "RuleImplementation"],
  ["decisionReferences", "DecisionReference"],
] as const;
export function nodeKey(type: EntityKind, id: string): NodeKey {
  return JSON.stringify([type, id]);
}
export function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function compareEdges(a: GraphEdge, b: GraphEdge): number {
  return (
    ordinal(a.edgeType, b.edgeType) || ordinal(a.source, b.source) || ordinal(a.target, b.target)
  );
}
export interface Projection {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly entities: ReadonlyMap<NodeKey, DomainEntity>;
}

export function project(a: Architecture): Projection {
  const nodes = new Map<NodeKey, GraphNode>();
  const entities = new Map<NodeKey, DomainEntity>();
  function addNode(type: EntityKind, entity: DomainEntity): void {
    const key = nodeKey(type, entity.id);
    nodes.set(key, Object.freeze({ key, entityType: type, entityId: entity.id }));
    entities.set(key, entity);
  }
  addNode("Architecture", a);
  for (const [field, type] of collections)
    for (const entity of a[field] ?? []) addNode(type, entity);
  const edges = new Map<string, GraphEdge>();
  function add(
    source: NodeKey,
    target: NodeKey,
    edgeType: EdgeType,
    evidence: EdgeProvenance,
  ): void {
    if (!nodes.has(source) || !nodes.has(target))
      throw new Error("Projected endpoint missing from validated Architecture.");
    const key = JSON.stringify([edgeType, source, target]);
    const prior = edges.get(key);
    const provenance = [...(prior?.provenance ?? [])];
    if (!provenance.some((p) => p.entity === evidence.entity && p.field === evidence.field))
      provenance.push(evidence);
    provenance.sort((x, y) => ordinal(x.entity, y.entity) || ordinal(x.field, y.field));
    edges.set(
      key,
      Object.freeze({
        key,
        source,
        target,
        edgeType,
        provenance: Object.freeze(provenance.map((p) => Object.freeze(p))),
      }),
    );
  }
  function ref(
    ownerType: EntityKind,
    owner: { readonly id: string },
    field: string,
    targetType: EntityKind,
    ids: readonly string[] | string | undefined,
    edgeType: EdgeType,
  ): void {
    for (const id of typeof ids === "string" ? [ids] : (ids ?? []))
      add(nodeKey(ownerType, owner.id), nodeKey(targetType, id), edgeType, {
        entity: nodeKey(ownerType, owner.id),
        field,
      });
  }
  for (const e of a.businessCapabilities ?? []) {
    ref(
      "BusinessCapability",
      e,
      "processIds",
      "Process",
      e.processIds,
      "BusinessCapability.process",
    );
    ref(
      "BusinessCapability",
      e,
      "flowFamilyIds",
      "FlowFamily",
      e.flowFamilyIds,
      "BusinessCapability.flowFamily",
    );
    ref("BusinessCapability", e, "roleIds", "Role", e.roleIds, "BusinessCapability.role");
  }
  for (const e of a.elements ?? [])
    ref("Element", e, "layerId", "Layer", e.layerId, "Element.layer");
  for (const e of a.layers ?? [])
    ref("Layer", e, "parentLayerId", "Layer", e.parentLayerId, "Layer.parentLayer");
  for (const e of a.relationships ?? []) {
    add(
      nodeKey("Element", e.sourceElementId),
      nodeKey("Relationship", e.id),
      "Relationship.sourceElement",
      { entity: nodeKey("Relationship", e.id), field: "sourceElementId" },
    );
    ref(
      "Relationship",
      e,
      "targetElementId",
      "Element",
      e.targetElementId,
      "Relationship.targetElement",
    );
  }
  for (const e of a.processes ?? []) {
    ref("Process", e, "dataObjectIds", "DataObject", e.dataObjectIds, "Process.dataObject");
    ref("Process", e, "roleIds", "Role", e.roleIds, "Process.role");
    ref("Process", e, "elementIds", "Element", e.elementIds, "Process.element");
    for (const r of e.flowReferences ?? [])
      ref(
        "Process",
        e,
        "flowReferences",
        "Flow",
        r.flowId,
        r.kind === "initiates" ? "Process.initiatesFlow" : "Process.usesFlow",
      );
  }
  for (const e of a.dataObjects ?? [])
    ref("DataObject", e, "elementIds", "Element", e.elementIds, "DataObject.element");
  for (const e of a.flows ?? []) {
    ref("Flow", e, "flowFamilyId", "FlowFamily", e.flowFamilyId, "Flow.flowFamily");
    ref("Flow", e, "dataObjectIds", "DataObject", e.dataObjectIds, "Flow.dataObject");
    ref("Flow", e, "startElementId", "Element", e.startElementId, "Flow.startElement");
    ref("Flow", e, "endElementId", "Element", e.endElementId, "Flow.endElement");
    ref("Flow", e, "flowSegmentIds", "FlowSegment", e.flowSegmentIds, "Flow.segment");
  }
  for (const e of a.flowSegments ?? []) {
    // The approved membership/composition exception shares one logical edge.
    add(nodeKey("Flow", e.flowId), nodeKey("FlowSegment", e.id), "Flow.segment", {
      entity: nodeKey("FlowSegment", e.id),
      field: "flowId",
    });
    ref(
      "FlowSegment",
      e,
      "sourceElementId",
      "Element",
      e.sourceElementId,
      "FlowSegment.sourceElement",
    );
    ref(
      "FlowSegment",
      e,
      "targetElementId",
      "Element",
      e.targetElementId,
      "FlowSegment.targetElement",
    );
    ref("FlowSegment", e, "dataObjectIds", "DataObject", e.dataObjectIds, "FlowSegment.dataObject");
    ref(
      "FlowSegment",
      e,
      "relationshipId",
      "Relationship",
      e.relationshipId,
      "FlowSegment.relationship",
    );
  }
  for (const e of a.roles ?? []) {
    ref("Role", e, "positionIds", "Position", e.positionIds, "Role.position");
    ref("Role", e, "flowIds", "Flow", e.flowIds, "Role.flow");
    ref("Role", e, "flowSegmentIds", "FlowSegment", e.flowSegmentIds, "Role.flowSegment");
    ref("Role", e, "dataObjectIds", "DataObject", e.dataObjectIds, "Role.dataObject");
  }
  for (const e of a.responsibilities ?? []) {
    ref(
      "Responsibility",
      e,
      "businessCapabilityIds",
      "BusinessCapability",
      e.businessCapabilityIds,
      "Responsibility.businessCapability",
    );
    ref("Responsibility", e, "processIds", "Process", e.processIds, "Responsibility.process");
    ref("Responsibility", e, "roleIds", "Role", e.roleIds, "Responsibility.role");
    ref("Responsibility", e, "elementIds", "Element", e.elementIds, "Responsibility.element");
  }
  for (const e of a.businessRules ?? []) {
    ref(
      "BusinessRule",
      e,
      "logicalLayerId",
      "Layer",
      e.logicalLayerId,
      "BusinessRule.logicalLayer",
    );
    ref("BusinessRule", e, "processIds", "Process", e.processIds, "BusinessRule.process");
    ref(
      "BusinessRule",
      e,
      "dataObjectIds",
      "DataObject",
      e.dataObjectIds,
      "BusinessRule.dataObject",
    );
    ref("BusinessRule", e, "flowIds", "Flow", e.flowIds, "BusinessRule.flow");
    ref(
      "BusinessRule",
      e,
      "flowSegmentIds",
      "FlowSegment",
      e.flowSegmentIds,
      "BusinessRule.flowSegment",
    );
    ref(
      "BusinessRule",
      e,
      "responsibilityIds",
      "Responsibility",
      e.responsibilityIds,
      "BusinessRule.responsibility",
    );
    ref("BusinessRule", e, "ownerRoleIds", "Role", e.ownerRoleIds, "BusinessRule.ownerRole");
  }
  for (const e of a.ruleImplementations ?? []) {
    ref(
      "RuleImplementation",
      e,
      "businessRuleId",
      "BusinessRule",
      e.businessRuleId,
      "RuleImplementation.businessRule",
    );
    ref(
      "RuleImplementation",
      e,
      "executingElementIds",
      "Element",
      e.executingElementIds,
      "RuleImplementation.executingElement",
    );
    ref(
      "RuleImplementation",
      e,
      "executingRoleIds",
      "Role",
      e.executingRoleIds,
      "RuleImplementation.executingRole",
    );
    ref(
      "RuleImplementation",
      e,
      "actualLayerId",
      "Layer",
      e.actualLayerId,
      "RuleImplementation.actualLayer",
    );
  }
  for (const e of a.decisionReferences ?? [])
    for (const r of e.affectedObjects)
      ref(
        "DecisionReference",
        e,
        "affectedObjects",
        r.entityType,
        r.entityId,
        "DecisionReference.affectedObject",
      );
  return {
    nodes: [...nodes.values()].sort((x, y) => ordinal(x.key, y.key)),
    edges: [...edges.values()].sort(compareEdges),
    entities,
  };
}
