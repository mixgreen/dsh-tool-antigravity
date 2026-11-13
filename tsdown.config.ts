import { defineConfig } from 'tsdown'

const packageName = 'dsh-tool-antigravity'

/** Build the Host rows, browser entry, and public companion modules. */
export default defineConfig([
  {
    name: packageName,
    entry: [
      'src/index.ts',
      'src/image.ts',
      'src/invariant.ts',
      'src/rpc-contract.ts',
      'src/project-context.ts',
      'src/wire-identity.ts',
      'src/llm-adapter.ts',
      'src/private-transport.ts',
      'src/replay.ts',
      'src/quota.ts',
      'src/media-admission.ts',
      'src/live-gates.ts',
      'src/live-gate-runner.ts',
    ],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    tsconfig: 'tsconfig.host.json',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: [/^@deepseek-ai\//, /^@cortexkit\//],
    },
  },
  {
    name: `${packageName}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    tsconfig: 'tsconfig.client.json',
    fixedExtension: true,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: [/^@deepseek-ai\//, /^react(?:\/|$)/],
    },
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(packageName)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
    footer: 'return module.exports;\n} });',
  },
])
