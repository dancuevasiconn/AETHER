import { validateArchitecture } from "../validation/index.js";
import { parseArchitectureJson } from "./json-parser.js";
import { mapPhysicalToDomain } from "./mapper.js";
import { validatePhysicalArchitecture } from "./physical-validation.js";
import type { ArchitectureLoadResult } from "./results.js";

/** The input is the text of a JSON file; this API performs no filesystem I/O. */
export function loadArchitectureFromJson(jsonText: string): ArchitectureLoadResult {
  const parsed = parseArchitectureJson(jsonText);
  if (!parsed.success) return { success: false, stage: "json-parse", errors: parsed.errors };
  const physical = validatePhysicalArchitecture(parsed.value);
  if (!physical.success)
    return { success: false, stage: "physical-schema", errors: physical.errors };

  let architecture;
  try {
    architecture = mapPhysicalToDomain(physical.document);
  } catch {
    return {
      success: false,
      stage: "mapping",
      errors: [
        {
          stage: "mapping",
          message: "Unexpected internal failure mapping schema-validated input.",
        },
      ],
    };
  }
  const domain = validateArchitecture(architecture);
  if (!domain.valid) {
    return {
      success: false,
      stage: "domain-validation",
      errors: domain.errors.map((error) => ({ ...error, stage: "domain-validation" })),
    };
  }
  return { success: true, architecture };
}
