import type { JsonParseError } from "./results.js";

export type JsonParseResult =
  | { readonly success: true; readonly value: unknown }
  | { readonly success: false; readonly errors: readonly JsonParseError[] };

/** Syntax only: any syntactically valid JSON value is accepted here. */
export function parseArchitectureJson(text: string): JsonParseResult {
  try {
    const value: unknown = JSON.parse(text);
    return { success: true, value };
  } catch (error: unknown) {
    return {
      success: false,
      errors: [
        {
          stage: "json-parse",
          message: error instanceof Error ? error.message : "Invalid JSON syntax.",
        },
      ],
    };
  }
}
