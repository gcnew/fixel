
export type Falsy = false | 0 | '' | null | undefined;

export function isTruthy<T>(x: T | Falsy): x is T {
    return !!x;
}

export function clamp(x: number, min: number, max: number) {
    return Math.max(min, Math.min(x, max));
}

export function uuid() {
    return crypto.randomUUID();
}

export function onlyKey(x: { [k: string]: unknown }) {
    const keys = Object.keys(x);
    return keys.length === 1 ? keys[0] : undefined;
}

export function assertNever(x: never) {
    throw new Error(`Not a never ${JSON.stringify(x)}`);
}

export type CacheCell<K, V> = { key: K | undefined, value: V | undefined }

export function cacheCellGet<K, V>(cell: CacheCell<K, V>, key: K, f: () => V): V {
    if (cell.key !== key || cell.value === undefined) {
        cell.key = key;
        cell.value = f();;
    }

    return cell.value;
}
