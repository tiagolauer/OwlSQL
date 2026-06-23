# Contributing

Maintainer notes for developing and releasing `sql-template-typed`.

## Development

```bash
npm install
npm run test:types   # tsc --noEmit over src + tests — the type assertions ARE the tests
npm run build        # emit dist/ with .d.ts
```

The test suite (`tests/types.test-d.ts`) is pure type assertions: if it
compiles, the inference is correct. There is no runtime test harness — the
runtime is a thin passthrough.

## Publishing

The package ships compiled JavaScript + declarations from `dist/`. The build is
wired into `prepublishOnly`, so a normal publish compiles for you:

```bash
npm version <patch|minor|major>
npm publish            # runs test:types, then build, then publishes dist/
```

Before the first registry publish, the package is still usable via a local path
(`npm i file:../sql-template-typed`), a tarball (`npm pack`), a workspace
protocol, or a git URL.
