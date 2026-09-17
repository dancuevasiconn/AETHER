import type { Architecture, DecisionReference, EntityKind } from "../domain/index.js";
import type { Physical, ValidatedPhysicalDocument } from "./physical-contract.js";

/**
 * Schema has already checked types, unions and non-empty tuples. Branded IDs are
 * compile-time only: this boundary preserves every string verbatim and clones
 * all data, including metadata. It neither resolves IDs nor validates the domain.
 */
function nominalize(value: Physical<Architecture>): Architecture {
  return structuredClone(value) as unknown as Architecture;
}

function inverse<Target extends { readonly id: string }, Source extends { readonly id: string }>(
  targets: readonly Target[] | undefined,
  sources: readonly Source[] | undefined,
  field: keyof Target,
  referencedIds: (source: Source) => readonly string[],
): readonly Target[] | undefined {
  return targets?.map((target) => {
    const ids = (sources ?? [])
      .filter((source) => referencedIds(source).includes(target.id))
      .map((source) => source.id);
    // These are set-like derived views, not a merge with an inverse input field.
    return ids.length === 0 ? target : { ...target, [field]: [...new Set(ids)] };
  });
}

function decisions<
  Target extends { readonly id: string; readonly decisionReferenceIds?: readonly string[] },
>(
  targets: readonly Target[] | undefined,
  sources: readonly DecisionReference[] | undefined,
  kind: EntityKind,
): readonly Target[] | undefined {
  return inverse(targets, sources, "decisionReferenceIds", (source) =>
    source.affectedObjects
      .filter((reference) => reference.entityType === kind)
      .map((reference) => reference.entityId),
  );
}

/** Accepts only schema-proven input. Missing references are retained, never repaired. */
export function mapPhysicalToDomain(document: ValidatedPhysicalDocument): Architecture {
  const a = nominalize(document.architecture);
  let capabilities = inverse(
    a.businessCapabilities,
    a.responsibilities,
    "responsibilityIds",
    (s) => s.businessCapabilityIds ?? [],
  );
  capabilities = decisions(capabilities, a.decisionReferences, "BusinessCapability");

  let processes = inverse(
    a.processes,
    a.businessCapabilities,
    "businessCapabilityIds",
    (s) => s.processIds ?? [],
  );
  processes = inverse(
    processes,
    a.responsibilities,
    "responsibilityIds",
    (s) => s.processIds ?? [],
  );
  processes = inverse(processes, a.businessRules, "businessRuleIds", (s) => s.processIds ?? []);
  processes = decisions(processes, a.decisionReferences, "Process");

  const responsibilities = inverse(
    a.responsibilities,
    a.businessRules,
    "businessRuleIds",
    (s) => s.responsibilityIds ?? [],
  );

  let elements = inverse(a.elements, a.processes, "processIds", (s) => s.elementIds ?? []);
  elements = inverse(elements, a.responsibilities, "responsibilityIds", (s) => s.elementIds ?? []);
  elements = inverse(elements, a.dataObjects, "dataObjectIds", (s) => s.elementIds ?? []);
  elements = inverse(
    elements,
    a.ruleImplementations,
    "ruleImplementationIds",
    (s) => s.executingElementIds ?? [],
  );
  elements = inverse(elements, a.flowSegments, "flowSegmentIds", (s) => [
    s.sourceElementId,
    s.targetElementId,
  ]);
  elements = decisions(elements, a.decisionReferences, "Element");

  let dataObjects = inverse(a.dataObjects, a.processes, "processIds", (s) => s.dataObjectIds ?? []);
  dataObjects = inverse(dataObjects, a.flows, "flowIds", (s) => s.dataObjectIds);
  dataObjects = inverse(
    dataObjects,
    a.businessRules,
    "businessRuleIds",
    (s) => s.dataObjectIds ?? [],
  );

  const flows = inverse(
    a.flows,
    a.processes,
    "processIds",
    (s) => s.flowReferences?.map((r) => r.flowId) ?? [],
  );
  let families = inverse(a.flowFamilies, a.flows, "flowIds", (s) => [s.flowFamilyId]);
  families = inverse(
    families,
    a.businessCapabilities,
    "businessCapabilityIds",
    (s) => s.flowFamilyIds ?? [],
  );

  let roles = inverse(a.roles, a.processes, "processIds", (s) => s.roleIds ?? []);
  roles = inverse(roles, a.responsibilities, "responsibilityIds", (s) => s.roleIds ?? []);
  roles = inverse(roles, a.businessRules, "ownedBusinessRuleIds", (s) => s.ownerRoleIds ?? []);
  roles = inverse(
    roles,
    a.ruleImplementations,
    "ruleImplementationIds",
    (s) => s.executingRoleIds ?? [],
  );
  roles = decisions(roles, a.decisionReferences, "Role");

  const positions = inverse(a.positions, a.roles, "roleIds", (s) => s.positionIds ?? []);
  let rules = inverse(a.businessRules, a.ruleImplementations, "ruleImplementationIds", (s) => [
    s.businessRuleId,
  ]);
  rules = decisions(rules, a.decisionReferences, "BusinessRule");

  return {
    ...a,
    ...(capabilities === undefined ? {} : { businessCapabilities: capabilities }),
    ...(processes === undefined ? {} : { processes }),
    ...(responsibilities === undefined ? {} : { responsibilities }),
    ...(elements === undefined ? {} : { elements }),
    ...(dataObjects === undefined ? {} : { dataObjects }),
    ...(flows === undefined ? {} : { flows }),
    ...(families === undefined ? {} : { flowFamilies: families }),
    ...(roles === undefined ? {} : { roles }),
    ...(positions === undefined ? {} : { positions }),
    ...(rules === undefined ? {} : { businessRules: rules }),
  };
}
