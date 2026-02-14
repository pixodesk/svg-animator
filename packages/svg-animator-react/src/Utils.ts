import { useRef } from 'react';

export function deepEquals(a: any, b: any): boolean {
    // Handle primitives and null
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    // Check for cycles using WeakSet
    const seen = new WeakSet();

    function equals(x: any, y: any): boolean {
        // Primitive/null check
        if (x === y) return true;
        if (x == null || y == null) return false;
        if (typeof x !== 'object' || typeof y !== 'object') return false;

        // Cycle detection
        if (seen.has(x)) {
            throw new Error('Circular reference detected');
        }
        seen.add(x);

        // Array check
        const xIsArray = Array.isArray(x);
        const yIsArray = Array.isArray(y);
        if (xIsArray !== yIsArray) return false;

        if (xIsArray) {
            if (x.length !== y.length) return false;
            for (let i = 0; i < x.length; i++) {
                if (!equals(x[i], y[i])) return false;
            }
            return true;
        }

        // Object check
        const xKeys = Object.keys(x);
        const yKeys = Object.keys(y);
        if (xKeys.length !== yKeys.length) return false;

        for (const key of xKeys) {
            if (!yKeys.includes(key)) return false;
            if (!equals(x[key], y[key])) return false;
        }

        return true;
    }

    return equals(a, b);
}


/**
 * Compares two arrays of dependencies using identity check first (===),
 * falling back to deep equality if references differ.
 * This is optimized for immutable data that may be recreated with same values.
 */
function areDepsEqual(prevDeps: Array<any>, nextDeps: Array<any>): boolean {
    if (prevDeps.length !== nextDeps.length) return false;

    for (let i = 0; i < prevDeps.length; i++) {
        // Fast path: same reference (common for immutable data)
        if (prevDeps[i] === nextDeps[i]) continue;

        // Slow path: different reference but possibly same content
        if (!deepEquals(prevDeps[i], nextDeps[i])) return false;
    }

    return true;
}

/**
 * Returns a stable numeric version ID that only increments when dependencies
 * actually change (by reference or deep equality).
 */
export function useDepsVersion(...deps: Array<any>): number {
    const cache = useRef<{
        versionId: number;
        deps: Array<any>;
    } | null>(null);

    // First render - initialize with version 1
    if (cache.current === null) {
        cache.current = {
            versionId: 1,
            deps: deps
        };
        return 1;
    }

    // Check if any dependency changed (by reference or value)
    if (!areDepsEqual(cache.current.deps, deps)) {
        // Dependencies changed - increment version and update cache
        cache.current = {
            versionId: cache.current.versionId + 1,
            deps: deps
        };
    }

    return cache.current.versionId;
}