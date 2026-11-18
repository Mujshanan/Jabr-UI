# BlockSuite block identity to Kernel NodeId

## Decision

- The BlockSuite model's durable string `model.id` remains the canonical authored block identity.
- Jabr-UI sends that opaque string as `blockId` in Engine bridge requests. It does not derive or allocate a numeric Kernel ID.
- Jabr-engine owns a per-document, durable, one-to-one registry from BlockSuite `blockId` strings to Kernel `NodeId` values.
- The registry is persisted with Engine-owned document identity/snapshot metadata, not in authored block properties and not in transient result state.
- Engine allocates IDs using the Kernel `NodeIdAllocator`, validates the non-zero JavaScript-safe range, and never reuses an ID within a document identity history.
- The mapping survives reload, undo/redo, and collaborative edits. Deleting a block retires its mapping; undo restores the same mapping. A block ID that reappears must resolve to its existing mapping.
- UI code must treat `nodeId` returned by Engine as opaque numeric identity and must not use it as a BlockSuite block ID.

## Why not hash or locally allocate?

A UUID-to-number hash can collide and therefore needs a collision registry anyway. Independent browser clients cannot safely allocate from independent Kernel allocators because each allocator is unique only within its own allocator namespace. Allocation must be authoritative in Engine, where the document registry and Kernel allocator are coordinated.

## Bridge behavior

Every request carries `documentId` and the durable string `blockId`. The Engine resolves the pair before graph construction. Responses include the resolved numeric `nodeId` so diagnostics and integration tests can correlate the Engine graph node without changing authored block identity.

The mapping is engine metadata, not an authored Yjs block property. Jabr-UI does not write it into the BlockSuite/Yjs authored block tree.
