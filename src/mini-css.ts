
type Accessor     = { name: string, func: () => string | number }
type CompiledRule = { name: string, extends: string[], props: Accessor[] }

export function compileStyle<T>(ctx0: Object, style: string): { [k: string]: T|undefined } {
    const vars: Accessor[] = [];
    const rules: CompiledRule[] = [];

    const left = style
        .trim()
        .replaceAll(/[a-z_]+\s*=[^;]*?;/gi, matched => {
            const compiled = compileVar(matched);
            if (!compiled) {
                return matched;
            }

            vars.push(compiled);
            return '';
        })
        .replaceAll(/[#.]?[a-z-_]+\s*{[^}]+?}/gi, matched => {
            const compiled = compileRule(matched);
            if (!compiled) {
                return matched;
            }

            rules.push(compiled);
            return '';
        });

    if (left.trim()) {
        console.warn(`Styles not fully parsed: <<<${left}>>>`);
    }

    const ctx = Object.create(Object.create(null), Object.getOwnPropertyDescriptors(ctx0));
    const varsEntries = vars.map(x => [x.name, { get: x.func }] as const);
    Object.defineProperties(ctx, Object.fromEntries(varsEntries));

    const rulesEntries = rules.map(x => {
        const final = applyExtends(x, rules, []);
        const propEntries = final.props.map(x => [x.name, { get: x.func }] as const);

        // TODO: this might not be ideal; in the perfect case we should not be copying the ctx properties to every style
        // also, it can be flattened instead of Object.create(ctx)
        const props = Object.defineProperties(Object.create(ctx), Object.fromEntries(propEntries));

        return [x.name, { value: props }] as const;
    });

    return Object.defineProperties(Object.create(null), Object.fromEntries(rulesEntries)) as any;
}

function compileVar(def: string): Accessor | undefined {
    const [_, name, expr] = /([a-z_]+)\s*=\s*([^;]*?;)/gi.exec(def) || [];
    if (!name) {
        return undefined;
    }

    const func = compileExpr(expr);
    if (!func) {
        return undefined;
    }

    return { name, func };
}

function compileRule(def: string): CompiledRule | undefined {
    const [_, name, body] = /([#.]?[a-z-_]+)\s*{([^}]+?)}/gi.exec(def) || [];
    if (!name) {
        return undefined;
    }

    const exts: string[] = [];
    const props: Accessor[] = [];

    const left = body
        .trim()
        .replaceAll(/\.\.\. *([#.]?[a-z-_]+);/gi, (_, name) => {
            exts.push(name);
            return '';
        })
        .replaceAll(/([a-z_]+)\s*:([^;]*?;)/gi, (matched, name, expr) => {
            const func = compileExpr(expr);
            if (!func) {
                return matched;
            }

            props.push({ name, func });
            return '';
        });

    if (left.trim()) {
        console.warn(`Rule \`${name}\` not fully compiled: <<<${left}>>>`);
    }

    return { name: name, extends: exts, props };
}

function compileExpr(expr: string): Accessor['func'] | undefined {
    const saved: string[] = [];
    const fixed = expr.trim()
        .replace(/'[^']*?'/g, matched => {
            saved.push(matched);
            return `___SAVED___`;
        })
        .replace(/[a-z_]+/gi, 'this.$&')
        .replace(/this\.___SAVED___/g, () => {
            return saved.shift()!;
        });

    return Function(`return ${fixed}`) as any;
}

function applyExtends(x: CompiledRule, xs: CompiledRule[], applied0: string[]): CompiledRule {
    if (!x.extends) {
        return x;
    }

    const finalProps: Accessor[] = [];
    const applied = [ ... applied0, x.name ];
    for (const ext of x.extends) {
        if (applied.includes(ext)) {
            continue;
        }

        const rule = xs.find(x => x.name === ext);
        if (!rule) {
            console.warn(`Cannot find rule \`${ext}\` referenced by \`${x.name}\``);
            continue;
        }

        const extended = applyExtends(rule, xs, applied);
        finalProps.push(... extended.props);
    }

    finalProps.push(... x.props);
    return { name: x.name, extends: x.extends, props: finalProps };
}
