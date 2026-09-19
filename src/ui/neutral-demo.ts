export const neutralDemoDocument = {
  schemaVersion: "0.1",
  architecture: {
    id: "demo-architecture",
    name: "Neutral Demonstration",
    modelVersion: "0.1",
    description: "Neutral browser demonstration",
    metadata: { purpose: "Visualization Engine smoke test" },
    businessCapabilities: [
      {
        id: "demo-capability",
        name: "Coordinate requests",
        processIds: ["demo-process"],
        flowFamilyIds: ["demo-family"],
        roleIds: ["demo-role"],
      },
    ],
    layers: [
      { id: "demo-governance", name: "Governance", apsLayer: "GOVERNANCE_POLICIES_DECISIONS" },
      { id: "demo-experience", name: "Experience", apsLayer: "EXPERIENCE_CUSTOMER_INTERACTION" },
      { id: "demo-integration", name: "Integration", apsLayer: "INTEGRATION_ORCHESTRATION" },
      { id: "demo-core", name: "Core", apsLayer: "CORE" },
    ],
    elements: [
      {
        id: "demo-entry",
        name: "Request entry",
        elementType: "COMPONENT",
        layerId: "demo-experience",
        architectureLevel: "APPLICATION",
      },
      {
        id: "demo-router",
        name: "Request routing",
        elementType: "COMPONENT",
        layerId: "demo-integration",
        architectureLevel: "APPLICATION",
      },
      {
        id: "demo-service",
        name: "Core service",
        elementType: "SERVICE",
        layerId: "demo-core",
        architectureLevel: "APPLICATION",
      },
    ],
    processes: [
      {
        id: "demo-process",
        name: "Handle request",
        dataObjectIds: ["demo-request"],
        flowReferences: [{ flowId: "demo-flow", kind: "initiates" }],
        roleIds: ["demo-role"],
        elementIds: ["demo-entry", "demo-service"],
      },
    ],
    dataObjects: [
      {
        id: "demo-request",
        name: "Request",
        elementIds: ["demo-entry", "demo-router", "demo-service"],
      },
    ],
    flowFamilies: [{ id: "demo-family", name: "Request handling" }],
    flows: [
      {
        id: "demo-flow",
        name: "Request delivery",
        description: "Neutral end-to-end route",
        flowFamilyId: "demo-family",
        dataObjectIds: ["demo-request"],
        startElementId: "demo-entry",
        endElementId: "demo-service",
        flowSegmentIds: ["demo-segment-1", "demo-segment-2"],
      },
    ],
    flowSegments: [
      {
        id: "demo-segment-1",
        flowId: "demo-flow",
        sequence: 1,
        sourceElementId: "demo-entry",
        targetElementId: "demo-router",
        dataObjectIds: ["demo-request"],
      },
      {
        id: "demo-segment-2",
        flowId: "demo-flow",
        sequence: 2,
        sourceElementId: "demo-router",
        targetElementId: "demo-service",
        dataObjectIds: ["demo-request"],
      },
    ],
    roles: [
      {
        id: "demo-role",
        name: "Request coordinator",
        flowIds: ["demo-flow"],
        flowSegmentIds: ["demo-segment-1", "demo-segment-2"],
        dataObjectIds: ["demo-request"],
      },
    ],
    businessRules: [
      {
        id: "demo-rule",
        name: "Validate request",
        logicalLayerId: "demo-governance",
        processIds: ["demo-process"],
        dataObjectIds: ["demo-request"],
        flowIds: ["demo-flow"],
        ownerRoleIds: ["demo-role"],
      },
    ],
    ruleImplementations: [
      {
        id: "demo-rule-implementation",
        businessRuleId: "demo-rule",
        implementationType: "CONFIGURATION",
        executingElementIds: ["demo-service"],
        actualLayerId: "demo-core",
        architectureLevel: "APPLICATION",
      },
    ],
  },
} as const;
