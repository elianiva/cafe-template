# Platform adapters

This folder holds the code that talks to Cloudflare: D1 queries, Durable Object
classes, R2 reads, and the structural types those adapters expose to a context.

The rule runs in one direction:

- A context defines the store or service it needs and imports no host module.
- A file here implements that service with a binding.
- `../handler.ts` wires the implementation into the RPC surface. Tests pass a
  fake store to `handlerFor` instead of starting the Worker.

Keep the adapter's public shape free of Cloudflare types when a context already
defines the interface. A `D1Database` can satisfy a small structural
`SqlRunner`, which keeps the context and its tests independent of the runtime.

The boundary test in `../boundaries.test.ts` enforces the context side. It
allows host imports here and rejects them under `../contexts`.
