import type { Architecture } from "../domain/index.js";
import type { ValidationError } from "../validation/index.js";

export interface JsonParseError {
  readonly stage: "json-parse";
  readonly message: string;
}

export interface PhysicalSchemaError {
  readonly stage: "physical-schema";
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
}

export interface MappingError {
  readonly stage: "mapping";
  readonly message: string;
}

export type DomainLoadError = ValidationError & { readonly stage: "domain-validation" };

export type ArchitectureLoadResult =
  | { readonly success: true; readonly architecture: Architecture }
  | {
      readonly success: false;
      readonly stage: "json-parse";
      readonly errors: readonly JsonParseError[];
    }
  | {
      readonly success: false;
      readonly stage: "physical-schema";
      readonly errors: readonly PhysicalSchemaError[];
    }
  | { readonly success: false; readonly stage: "mapping"; readonly errors: readonly MappingError[] }
  | {
      readonly success: false;
      readonly stage: "domain-validation";
      readonly errors: readonly DomainLoadError[];
    };
