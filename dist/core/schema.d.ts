export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export type Scalar = string | number | boolean | null;
export type SchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
export interface Schema {
    type?: SchemaType;
    oneOf?: Schema[];
    anyOf?: Schema[];
    properties?: Record<string, Schema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: Schema;
    enum?: Scalar[];
    const?: Scalar;
    title?: string;
    description?: string;
    default?: JsonValue;
    examples?: JsonValue;
}
export declare class SchemaError extends Error {
    readonly violations: string[];
    constructor(violations: string[]);
}
export declare function isJsonValue(v: unknown): v is JsonValue;
/** Assert `raw` is a schema in the subset; every violation is reported, not just the first. */
export declare function assertSchema(raw: unknown, path?: string): Schema;
/** Validate `value` against an asserted schema. Total: never throws on any value. */
export declare function validate(schema: Schema, value: unknown, path?: string): string[];
/** The property names an object schema reads at its top level — `properties` and `required`, its own and each `oneOf` and `anyOf` branch's — in order, once each. */
export declare function namesRead(schema: Schema): string[];
/** The `default` of each declared property, for an object-rooted schema. */
export declare function defaultsOf(schema: Schema): Record<string, JsonValue>;
