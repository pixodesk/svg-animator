/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Lightweight Zod-like schema system — type declaration + runtime sanitization.
 *
 * Two operations per schema:
 *   isValid(raw)     — true only when raw already conforms; no repair needed.
 *   sanitize(raw)    — always returns T; fixes or replaces invalid input with defaults.
 *
 * Field rules inside px.object():
 *   required field   → if absent/invalid, field's declared default is used.
 *   optional field   → if absent/invalid (or wrong JS type), field becomes undefined.
 *
 * Array: items that cannot even be attempted are filtered out.
 * Record: values that cannot even be attempted are dropped.
 *
 * The distinction between isValid and _canSanitize:
 *   isValid        — strict; ALL fields must be correct, no repairs accepted.
 *   _canSanitize   — permissive; "is the JS type right enough to attempt repair?"
 *                    For containers (object/array/record) this is a structural check
 *                    so that partially-valid nested objects are sanitized rather than dropped.
 *                    For primitives it equals isValid (a wrong primitive type is unrecoverable).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PxSchema<T, IsOptional extends boolean = false> {
    /** Phantom discriminator — `false` for required schemas, `true` for optional. Used by InferShape. */
    readonly _optional: IsOptional;
    sanitize(raw: unknown): T;
    isValid(raw: unknown): boolean;
    /** True if raw has the right structure to attempt sanitization (may still need repair). */
    _canSanitize(raw: unknown): boolean;
    readonly _default: T;
    /** Returns a new schema that marks this field as optional (?: in object shapes). */
    optional(): PxSchema<T | undefined, true>;
}

/** Extract the TypeScript type from a schema. */
export type PxInfer<S> = S extends PxSchema<infer T, any> ? T : never;


// ─────────────────────────────────────────────────────────────────────────────
// Base — default _canSanitize = isValid (correct for primitives)
// ─────────────────────────────────────────────────────────────────────────────

/** Shared base; overrides _canSanitize only when the structural check must differ from isValid. */
abstract class Base<T, IsOptional extends boolean = false> implements PxSchema<T, IsOptional> {
    // `declare` emits no runtime code; purely satisfies the interface's phantom _optional property.
    declare readonly _optional: IsOptional;
    abstract sanitize(raw: unknown): T;
    abstract isValid(raw: unknown): boolean;
    abstract readonly _default: T;

    _canSanitize(raw: unknown): boolean { return this.isValid(raw); }

    optional(): PxSchema<T | undefined, true> { return new Optional(this); }
}


// ─────────────────────────────────────────────────────────────────────────────
// Optional wrapper
// Uses _canSanitize (not isValid) so that partially-valid nested objects are
// repaired rather than dropped entirely.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps any schema to make its value optional.
 * sanitize uses _canSanitize (not isValid) so partially-valid objects are repaired, not dropped.
 */
class Optional<T> extends Base<T | undefined, true> {
    readonly _default = undefined as T | undefined;
    constructor(private readonly inner: PxSchema<T, any>) { super(); }

    sanitize(raw: unknown): T | undefined {
        if (raw === undefined || raw === null) return undefined;
        return this.inner._canSanitize(raw) ? this.inner.sanitize(raw) : undefined;
    }

    isValid(raw: unknown): boolean {
        return raw === undefined || raw === null || this.inner.isValid(raw);
    }

    override _canSanitize(raw: unknown): boolean {
        return raw === undefined || raw === null || this.inner._canSanitize(raw);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Primitives — _canSanitize = isValid (a wrong primitive type is unrecoverable)
// ─────────────────────────────────────────────────────────────────────────────

/** String schema; wrong type is unrecoverable so _canSanitize = isValid (inherited default). */
class Str extends Base<string> {
    constructor(readonly _default: string = '') { super(); }
    sanitize(raw: unknown): string { return typeof raw === 'string' ? raw : this._default; }
    isValid(raw: unknown): boolean { return typeof raw === 'string'; }
}

/** Finite-number schema; rejects NaN and ±Infinity as unrecoverable. */
class Num extends Base<number> {
    constructor(readonly _default: number = 0) { super(); }
    sanitize(raw: unknown): number {
        return typeof raw === 'number' && isFinite(raw) ? raw : this._default;
    }
    isValid(raw: unknown): boolean { return typeof raw === 'number' && isFinite(raw); }
}

/** Boolean schema. */
class Bool extends Base<boolean> {
    constructor(readonly _default: boolean = false) { super(); }
    sanitize(raw: unknown): boolean { return typeof raw === 'boolean' ? raw : this._default; }
    isValid(raw: unknown): boolean { return typeof raw === 'boolean'; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Literal — exact value match; default is the literal itself
// ─────────────────────────────────────────────────────────────────────────────

/** Matches one exact primitive value; its _default is the value itself. */
class Literal<T extends string | number | boolean> extends Base<T> {
    readonly _default: T;
    constructor(private readonly value: T) { super(); this._default = value; }
    sanitize(raw: unknown): T { return raw === this.value ? this.value : this._default; }
    isValid(raw: unknown): boolean { return raw === this.value; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Enum — union of string/number literals; default is first value
// ─────────────────────────────────────────────────────────────────────────────

/** Union of string/number literals; _default is the first value unless overridden. */
class Enum<T extends string | number> extends Base<T> {
    readonly _default: T;
    constructor(private readonly values: readonly T[], defaultVal?: T) {
        super();
        this._default = defaultVal ?? values[0];
    }
    sanitize(raw: unknown): T { return this.values.includes(raw as T) ? (raw as T) : this._default; }
    isValid(raw: unknown): boolean { return this.values.includes(raw as T); }
}


// ─────────────────────────────────────────────────────────────────────────────
// Union — first matching schema wins
// _canSanitize: true if any member can attempt sanitization
// ─────────────────────────────────────────────────────────────────────────────

/** Tries member schemas in order; first whose isValid passes wins. sanitize returns _default when none match. */
class Union<T> extends Base<T> {
    readonly _default: T;
    constructor(private readonly schemas: ReadonlyArray<PxSchema<T>>, defaultVal?: T) {
        super();
        this._default = defaultVal ?? schemas[0]._default;
    }
    sanitize(raw: unknown): T {
        for (const s of this.schemas) {
            if (s.isValid(raw)) return s.sanitize(raw);
        }
        return this._default;
    }
    isValid(raw: unknown): boolean { return this.schemas.some(s => s.isValid(raw)); }
    override _canSanitize(raw: unknown): boolean { return this.schemas.some(s => s._canSanitize(raw)); }
}

// Infers the union of all member types from a tuple of schemas
type UnionMembers<T extends ReadonlyArray<PxSchema<any, any>>> =
    T extends ReadonlyArray<PxSchema<infer U, any>> ? U : never;


// ─────────────────────────────────────────────────────────────────────────────
// Object — strips unknown keys; required fields use default, optional → undefined
// _canSanitize: true when raw is a plain (non-array) object
// ─────────────────────────────────────────────────────────────────────────────

type AnyShape = Record<string, PxSchema<any, any>>;

// Required keys: IsOptional=false → plain property.
// Optional keys: IsOptional=true  → ?:, with Exclude<T,undefined> (?: already adds undefined).
type InferShape<S extends AnyShape> =
    { [K in keyof S as S[K] extends PxSchema<any, true> ? never : K]: PxInfer<S[K]> } &
    { [K in keyof S as S[K] extends PxSchema<any, true> ? K : never]?: Exclude<PxInfer<S[K]>, undefined> };

/**
 * Typed object schema; strips unknown keys, repairs required fields via their defaults.
 * _canSanitize checks structure only (non-array object) so partially-valid objects are repaired.
 */
class Obj<S extends AnyShape> extends Base<InferShape<S>> {
    readonly _default: InferShape<S>;

    constructor(private readonly shape: S) {
        super();
        const d: any = {};
        for (const key of Object.keys(shape)) d[key] = shape[key]._default;
        this._default = d;
    }

    sanitize(raw: unknown): InferShape<S> {
        const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as any : {};
        const out: any = {};
        for (const key of Object.keys(this.shape)) {
            out[key] = this.shape[key].sanitize(src[key]);
        }
        return out;
    }

    isValid(raw: unknown): boolean {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        const obj = raw as any;
        for (const key of Object.keys(this.shape)) {
            if (!this.shape[key].isValid(obj[key])) return false;
        }
        return true;
    }

    override _canSanitize(raw: unknown): boolean {
        return !!raw && typeof raw === 'object' && !Array.isArray(raw);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// OpenObj — like Obj but passes unknown keys through unchanged.
// Known keys are validated/sanitized; extra keys are kept as-is.
// Inferred type: InferShape<S> & { [key: string]: any }.
// Note: TypeScript intersection semantics mean named-property access on the
// derived type yields `any` rather than the specific declared type. For
// type-precise access keep a hand-written interface alongside the schema.
// ─────────────────────────────────────────────────────────────────────────────

type InferOpenShape<S extends AnyShape> = InferShape<S> & { [key: string]: any };

/**
 * Open object schema; validates/repairs known keys, passes unknown keys through unchanged.
 * Use when the object may carry arbitrary extra properties (e.g. SVG element attributes).
 */
class OpenObj<S extends AnyShape> extends Base<InferOpenShape<S>> {
    readonly _default: InferOpenShape<S>;

    constructor(private readonly shape: S) {
        super();
        const d: any = {};
        for (const key of Object.keys(shape)) d[key] = shape[key]._default;
        this._default = d;
    }

    sanitize(raw: unknown): InferOpenShape<S> {
        const src: Record<string, unknown> = (raw && typeof raw === 'object' && !Array.isArray(raw))
            ? raw as Record<string, unknown>
            : {};
        const out: Record<string, unknown> = { ...src };
        for (const key of Object.keys(this.shape)) {
            out[key] = this.shape[key].sanitize(src[key]);
        }
        return out as InferOpenShape<S>;
    }

    isValid(raw: unknown): boolean {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        const obj = raw as any;
        for (const key of Object.keys(this.shape)) {
            if (!this.shape[key].isValid(obj[key])) return false;
        }
        return true;
    }

    override _canSanitize(raw: unknown): boolean {
        return !!raw && typeof raw === 'object' && !Array.isArray(raw);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Array — items that cannot be attempted are filtered out; default is []
// Uses _canSanitize for filtering so partially-valid objects are repaired, not dropped.
// ─────────────────────────────────────────────────────────────────────────────

/** Array schema; items failing _canSanitize are filtered out rather than blocking the whole array. */
class Arr<T> extends Base<Array<T>> {
    readonly _default: Array<T> = [];
    constructor(private readonly item: PxSchema<T>) { super(); }

    sanitize(raw: unknown): Array<T> {
        if (!Array.isArray(raw)) return [];
        const out: Array<T> = [];
        for (const el of raw) {
            if (this.item._canSanitize(el)) out.push(this.item.sanitize(el));
        }
        return out;
    }

    isValid(raw: unknown): boolean {
        return Array.isArray(raw) && raw.every(el => this.item.isValid(el));
    }

    override _canSanitize(raw: unknown): boolean { return Array.isArray(raw); }
}


// ─────────────────────────────────────────────────────────────────────────────
// Record — invalid values are dropped; default is {}
// ─────────────────────────────────────────────────────────────────────────────

/** String-keyed record; values failing _canSanitize are dropped rather than blocking the whole record. */
class Rec<T> extends Base<Record<string, T>> {
    readonly _default: Record<string, T> = {};
    constructor(private readonly value: PxSchema<T>) { super(); }

    sanitize(raw: unknown): Record<string, T> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out: Record<string, T> = {};
        for (const [k, v] of Object.entries(raw)) {
            if (this.value._canSanitize(v)) out[k] = this.value.sanitize(v);
        }
        return out;
    }

    isValid(raw: unknown): boolean {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        return Object.values(raw as object).every(v => this.value.isValid(v));
    }

    override _canSanitize(raw: unknown): boolean {
        return !!raw && typeof raw === 'object' && !Array.isArray(raw);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Any — passes raw through unchanged, always valid
// ─────────────────────────────────────────────────────────────────────────────

/** Passes any value through unchanged; always valid. Useful for opaque blobs with no schema. */
class Any extends Base<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly _default: any = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sanitize(raw: unknown): any { return raw; }
    isValid(_raw: unknown): boolean { return true; }
    override _canSanitize(_raw: unknown): boolean { return true; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Lazy — resolves schema on first use, required for recursive types
// ─────────────────────────────────────────────────────────────────────────────

/** Defers schema resolution to first use; required to break circular references in recursive types. */
class Lazy<T> extends Base<T> {
    private resolved: PxSchema<T> | null = null;
    constructor(private readonly fn: () => PxSchema<T>, readonly _default: T) { super(); }

    private get schema(): PxSchema<T> {
        return this.resolved ?? (this.resolved = this.fn());
    }

    sanitize(raw: unknown): T { return this.schema.sanitize(raw); }
    isValid(raw: unknown): boolean { return this.schema.isValid(raw); }
    override _canSanitize(raw: unknown): boolean { return this.schema._canSanitize(raw); }
}


// ─────────────────────────────────────────────────────────────────────────────
// Tuple — fixed-length array with per-position schemas; default is defaults of each position
// _canSanitize: true only when raw is an array of the exact expected length
// ─────────────────────────────────────────────────────────────────────────────

// Maps a tuple of schemas to a tuple of their inferred types.
type TupleItems<T extends ReadonlyArray<PxSchema<any, any>>> =
    { -readonly [K in keyof T]: T[K] extends PxSchema<infer U, any> ? U : never };

/** Fixed-length array schema; validates element count and each position individually. */
class Tuple<T extends ReadonlyArray<PxSchema<any, any>>> extends Base<TupleItems<T>> {
    readonly _default: TupleItems<T>;

    constructor(private readonly schemas: T) {
        super();
        this._default = schemas.map(s => s._default) as unknown as TupleItems<T>;
    }

    sanitize(raw: unknown): TupleItems<T> {
        if (!Array.isArray(raw) || raw.length !== this.schemas.length) return this._default;
        return this.schemas.map((s, i) => s.sanitize((raw as unknown[])[i])) as unknown as TupleItems<T>;
    }

    isValid(raw: unknown): boolean {
        if (!Array.isArray(raw) || raw.length !== this.schemas.length) return false;
        return (this.schemas as ReadonlyArray<PxSchema<any, any>>).every((s, i) => s.isValid((raw as unknown[])[i]));
    }

    // Require exact length so wrong-length arrays are dropped rather than repaired to default.
    override _canSanitize(raw: unknown): boolean {
        return Array.isArray(raw) && raw.length === this.schemas.length;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Public factory
// ─────────────────────────────────────────────────────────────────────────────

export const px = {
    /** Matches a string. Default: '' or provided value. */
    string:  (defaultVal = ''): PxSchema<string>     => new Str(defaultVal),

    /** Matches a finite number. Default: 0 or provided value. */
    number:  (defaultVal = 0): PxSchema<number>      => new Num(defaultVal),

    /** Matches a boolean. Default: false or provided value. */
    boolean: (defaultVal = false): PxSchema<boolean> => new Bool(defaultVal),

    /** Matches one exact primitive value; its default is the value itself. */
    literal: <T extends string | number | boolean>(value: T): PxSchema<T> =>
        new Literal(value),

    /** Matches one of a fixed set of string/number values. Default: first value. */
    enum: <T extends string | number>(values: readonly T[], defaultVal?: T): PxSchema<T> =>
        new Enum(values, defaultVal),

    /**
     * Returns the first schema whose isValid passes.
     * TypeScript infers the union of all member types automatically.
     */
    union: <T extends ReadonlyArray<PxSchema<any, any>>>(
        schemas: T,
        defaultVal?: UnionMembers<T>
    ): PxSchema<UnionMembers<T>> =>
        new Union(schemas as any, defaultVal) as any,

    /** Typed object — unknown keys are stripped. Required fields fall back to their default. */
    object: <S extends AnyShape>(shape: S): PxSchema<InferShape<S>> =>
        new Obj(shape),

    /** Open object — validates known keys, passes unknown keys through unchanged. */
    openObject: <S extends AnyShape>(shape: S): PxSchema<InferOpenShape<S>> =>
        new OpenObj(shape),

    /** Array whose unrecoverable items are filtered out. Default: []. */
    array: <T>(item: PxSchema<T>): PxSchema<Array<T>> =>
        new Arr(item),

    /** String-keyed record whose unrecoverable values are dropped. Default: {}. */
    record: <T>(value: PxSchema<T>): PxSchema<Record<string, T>> =>
        new Rec(value),

    /** Passes anything through unchanged — always valid. */
    any: (): PxSchema<any> => new Any(),

    /** Fixed-length tuple — validates element count and each position individually. */
    tuple: <T extends ReadonlyArray<PxSchema<any, any>>>(schemas: T): PxSchema<TupleItems<T>> =>
        new Tuple(schemas),

    /** Defers schema creation — required for recursive types. Must supply a default value. */
    lazy: <T>(fn: () => PxSchema<T>, defaultVal: T): PxSchema<T> =>
        new Lazy(fn, defaultVal),
} as const;