import { Ajv2020 } from "ajv/dist/2020.js";

import schema from "../schema/architecture-v0.1.schema.json" with { type: "json" };
import type { PhysicalDocument, ValidatedPhysicalDocument } from "./physical-contract.js";
import type { PhysicalSchemaError } from "./results.js";

// Compile once. Do not coerce values, remove properties, or populate defaults.
const validate = new Ajv2020({ strict: true, allErrors: true }).compile<PhysicalDocument>(schema);

export type PhysicalValidationResult =
  | { readonly success: true; readonly document: ValidatedPhysicalDocument }
  | { readonly success: false; readonly errors: readonly PhysicalSchemaError[] };

function pointerPart(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function validatePhysicalArchitecture(value: unknown): PhysicalValidationResult {
  if (validate(value)) {
    // The marker records schema validation; it does not add data to the input.
    return { success: true, document: value as ValidatedPhysicalDocument };
  }
  const errors: PhysicalSchemaError[] = (validate.errors ?? []).map((error) => {
    const property: unknown =
      error.keyword === "required"
        ? error.params.missingProperty
        : error.keyword === "additionalProperties"
          ? error.params.additionalProperty
          : undefined;
    return {
      stage: "physical-schema",
      path: error.instancePath + (typeof property === "string" ? `/${pointerPart(property)}` : ""),
      keyword: error.keyword,
      message: error.message ?? "Physical schema rule failed.",
    };
  });
  return { success: false, errors };
}
