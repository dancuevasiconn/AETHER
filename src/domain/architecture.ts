import type { BusinessCapability } from "./capabilities.js";
import type { DecisionReference } from "./decisions.js";
import type { Flow, FlowFamily, FlowSegment } from "./flows.js";
import type { ArchitectureId } from "./identifiers.js";
import type { Position, Responsibility, Role } from "./organization.js";
import type { DataObject, Process } from "./processes.js";
import type { Layer } from "./positioning.js";
import type { BusinessRule, RuleImplementation } from "./rules.js";
import type { Element, Relationship } from "./technology.js";

/** Descriptive, non-visual metadata. Its physical structure remains intentionally open. */
export type ArchitectureMetadata = Readonly<Record<string, unknown>>;

/** The single root of one logical Architecture Model load. */
export interface Architecture {
  readonly id: ArchitectureId;
  readonly name: string;
  readonly modelVersion: string;
  readonly metadata: ArchitectureMetadata;
  readonly description?: string;
  readonly businessCapabilities?: readonly BusinessCapability[];
  readonly elements?: readonly Element[];
  readonly relationships?: readonly Relationship[];
  readonly layers?: readonly Layer[];
  readonly processes?: readonly Process[];
  readonly dataObjects?: readonly DataObject[];
  readonly flows?: readonly Flow[];
  readonly flowSegments?: readonly FlowSegment[];
  readonly flowFamilies?: readonly FlowFamily[];
  readonly roles?: readonly Role[];
  readonly positions?: readonly Position[];
  readonly responsibilities?: readonly Responsibility[];
  readonly businessRules?: readonly BusinessRule[];
  readonly ruleImplementations?: readonly RuleImplementation[];
  readonly decisionReferences?: readonly DecisionReference[];
}
