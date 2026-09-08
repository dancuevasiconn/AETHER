import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  Architecture,
  ArchitectureId,
  ArchitectureLevel,
  BusinessCapability,
  BusinessCapabilityId,
  BusinessRule,
  BusinessRuleId,
  DataObject,
  DataObjectId,
  DecisionReference,
  DecisionReferenceId,
  Element,
  ElementId,
  Flow,
  FlowFamily,
  FlowFamilyId,
  FlowId,
  FlowSegment,
  FlowSegmentId,
  Layer,
  LayerId,
  Position,
  PositionId,
  Process,
  ProcessId,
  Relationship,
  RelationshipId,
  Responsibility,
  ResponsibilityId,
  Role,
  RoleId,
  RuleImplementation,
  RuleImplementationId,
} from "../src/domain/index.js";

const id = <Id extends string>(value: string): Id => value as Id;

describe("Architecture Domain Model v0.1", () => {
  it("constructs all 16 canonical entities", () => {
    const layer: Layer = { id: id<LayerId>("layer-governance"), name: "Governance" };
    const capability: BusinessCapability = {
      id: id<BusinessCapabilityId>("capability-1"),
      name: "Manage purchasing",
    };
    const element: Element = {
      id: id<ElementId>("element-1"),
      name: "Purchasing service",
      elementType: "Service",
    };
    const relationship: Relationship = {
      id: id<RelationshipId>("relationship-1"),
      relationshipType: "connects_to",
      sourceElementId: element.id,
      targetElementId: id<ElementId>("element-2"),
    };
    const process: Process = { id: id<ProcessId>("process-1"), name: "Create order" };
    const dataObject: DataObject = {
      id: id<DataObjectId>("data-object-1"),
      name: "Purchase order",
    };
    const flowFamily: FlowFamily = {
      id: id<FlowFamilyId>("flow-family-1"),
      name: "Purchasing",
    };
    const segment: FlowSegment = {
      id: id<FlowSegmentId>("segment-1"),
      flowId: id<FlowId>("flow-1"),
      sequence: 1,
      sourceElementId: element.id,
      targetElementId: relationship.targetElementId,
      dataObjectIds: [dataObject.id],
    };
    const flow: Flow = {
      id: segment.flowId,
      name: "Purchase order processing",
      description: "End-to-end purchase order journey",
      flowFamilyId: flowFamily.id,
      dataObjectIds: [dataObject.id],
      startElementId: segment.sourceElementId,
      endElementId: segment.targetElementId,
      flowSegmentIds: [segment.id],
    };
    const role: Role = { id: id<RoleId>("role-1"), name: "Buyer" };
    const position: Position = { id: id<PositionId>("position-1"), name: "Manager" };
    const responsibility: Responsibility = {
      id: id<ResponsibilityId>("responsibility-1"),
      name: "Purchasing management",
    };
    const businessRule: BusinessRule = {
      id: id<BusinessRuleId>("rule-1"),
      name: "Approve purchase",
      logicalLayerId: layer.id,
    };
    const ruleImplementation: RuleImplementation = {
      id: id<RuleImplementationId>("implementation-1"),
      businessRuleId: businessRule.id,
      implementationType: "MANUAL",
      executingRoleIds: [role.id],
    };
    const decision: DecisionReference = {
      id: id<DecisionReferenceId>("decision-1"),
      title: "Domain model decision",
      status: "accepted",
      reference: "AETHER-ADR-0002",
      affectedObjects: [{ entityType: "BusinessRule", entityId: businessRule.id }],
    };
    const architecture: Architecture = {
      id: id<ArchitectureId>("architecture-1"),
      name: "AETHER example",
      modelVersion: "0.1",
      metadata: {},
      businessCapabilities: [capability],
      elements: [element],
      relationships: [relationship],
      layers: [layer],
      processes: [process],
      dataObjects: [dataObject],
      flows: [flow],
      flowSegments: [segment],
      flowFamilies: [flowFamily],
      roles: [role],
      positions: [position],
      responsibilities: [responsibility],
      businessRules: [businessRule],
      ruleImplementations: [ruleImplementation],
      decisionReferences: [decision],
    };

    expect(architecture.modelVersion).toBe("0.1");
    expect(architecture.ruleImplementations).toHaveLength(1);
  });

  it("allows architecture information declared incomplete by the model", () => {
    const elementWithoutPosition: Element = {
      id: id<ElementId>("unclassified-element"),
      name: "Unclassified element",
      elementType: "Unknown",
    };
    const roleWithoutPosition: Role = { id: id<RoleId>("unassigned-role"), name: "Owner" };
    const responsibilityWithoutRole: Responsibility = {
      id: id<ResponsibilityId>("unowned-responsibility"),
      name: "Unowned responsibility",
    };
    const ruleWithoutOwnerOrImplementation: BusinessRule = {
      id: id<BusinessRuleId>("unowned-rule"),
      name: "Unowned rule",
      logicalLayerId: id<LayerId>("governance"),
    };

    expect(elementWithoutPosition.layerId).toBeUndefined();
    expect(elementWithoutPosition.architectureLevel).toBeUndefined();
    expect(roleWithoutPosition.positionIds).toBeUndefined();
    expect(responsibilityWithoutRole.roleIds).toBeUndefined();
    expect(ruleWithoutOwnerOrImplementation.ownerRoleIds).toBeUndefined();
    expect(ruleWithoutOwnerOrImplementation.ruleImplementationIds).toBeUndefined();
  });

  it("keeps canonical concepts as distinct static types", () => {
    expectTypeOf<Process>().not.toEqualTypeOf<Flow>();
    expectTypeOf<Relationship>().not.toEqualTypeOf<FlowSegment>();
    expectTypeOf<Role>().not.toEqualTypeOf<Position>();
    expectTypeOf<BusinessRule>().not.toEqualTypeOf<RuleImplementation>();
  });

  it("limits ArchitectureLevel to the three approved values", () => {
    expectTypeOf<ArchitectureLevel>().toEqualTypeOf<"BUSINESS" | "APPLICATION" | "TECHNOLOGY">();
  });
});
