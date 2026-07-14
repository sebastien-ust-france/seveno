import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolvePath(import.meta.dirname, '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export%20{}', shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    return {
      url: pathToFileURL(resolvePath(projectRoot, `${specifier.slice(2)}.ts`)).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
