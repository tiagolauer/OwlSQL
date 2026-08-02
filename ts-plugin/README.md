# @owlsql/ts-plugin

Editor autocomplete, hover info, and live diagnostics for [OwlSQL](https://github.com/tiagolauer/OwlSQL) query strings.

A TypeScript Language Service Plugin: it runs inside `tsserver`, the process that already powers VSCode's IntelliSense, and completes column names *while you are still typing the query string* — before it is valid SQL, which is earlier than type-checking can help.

```bash
npm install --save-dev @owlsql/ts-plugin
```

> **Not on npm yet.** Until this package is published, build it from a clone
> and install the folder instead:
>
> ```bash
> git clone https://github.com/tiagolauer/OwlSQL
> cd OwlSQL && npm install && npm run build --workspace @owlsql/ts-plugin
> npm install --save-dev /path/to/OwlSQL/ts-plugin   # from your project
> ```

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@owlsql/ts-plugin" }]
  }
}
```

In VSCode, run **"TypeScript: Select TypeScript Version" → "Use Workspace Version"** from the Command Palette. This is not optional: VSCode's bundled TypeScript does not load workspace plugins, and skipping it is the most common reason a plugin appears to do nothing.

## Requires TypeScript < 7

TypeScript 7's native compiler ships no public compiler API, and the `tsserver` protocol that loads plugins has been replaced by LSP. That takes out every language service plugin built the classic way, not just this one. TypeScript 7.1 is expected to introduce a new — and different — programmatic API.

The `peerDependencies` range enforces this, and the package stays on `0.x` for as long as the situation is upstream's to resolve.

`@owlsql/core` itself is unaffected: it is pure type-level inference, needs no compiler API, and is tested against TypeScript 7 in CI. The two ship separately precisely so the library is not held to the plugin's narrower range.

## What it does

Full documentation, including the exact scope of what is and isn't completed or diagnosed, lives in the [Editor autocomplete section of the main README](../README.md#editor-autocomplete). [`examples/ts-plugin-demo`](../examples/ts-plugin-demo) is a ready-to-open VSCode project for trying it.

## License

MIT
