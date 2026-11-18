/** Browser-facing DTOs. These are transport contracts, not persisted Yjs block props. */

export const ENGINE_BRIDGE_PROTOCOL_VERSION = 1 as const;
export const KERNEL_ENVELOPE_SCHEMA_VERSION = 1 as const;
export const KERNEL_MAX_NODE_ID = Number.MAX_SAFE_INTEGER;

export type KernelNodeId = number & { readonly __brand: 'KernelNodeId' };

export function asKernelNodeId(value: number): KernelNodeId {
  if (!Number.isSafeInteger(value) || value <= 0 || value > KERNEL_MAX_NODE_ID) {
    throw new RangeError('NodeId must be a non-zero JavaScript-safe integer.');
  }
  return value as KernelNodeId;
}

export type KernelSpan = {
  /** UTF-8 byte offset, inclusive. */
  start: number;
  /** UTF-8 byte offset, exclusive. */
  end: number;
};

export type KernelDiagnostic = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  span?: KernelSpan | null;
};

/** Mirrors jabr-kernel::Envelope<T> JSON serialization (schema_version/result/diagnostics). */
export type KernelEnvelope<T> = {
  schema_version: typeof KERNEL_ENVELOPE_SCHEMA_VERSION;
  result: T | null;
  diagnostics: KernelDiagnostic[];
};

export type EngineRequest<TPayload> = {
  protocolVersion: typeof ENGINE_BRIDGE_PROTOCOL_VERSION;
  engineName: 'jabr-engine';
  requestId: string;
  documentId: string;
  /** Durable BlockSuite model.id; Engine resolves it to its Kernel NodeId. */
  blockId: string;
  sourceRevision: number;
  operation: string;
  payload: TPayload;
};

export type EngineResponse<TResult> = {
  protocolVersion: typeof ENGINE_BRIDGE_PROTOCOL_VERSION;
  engineName: 'jabr-engine';
  engineVersion: string;
  requestId: string;
  documentId: string;
  blockId: string;
  sourceRevision: number;
  /** Kernel identity resolved for this durable BlockSuite block. */
  nodeId: KernelNodeId;
  envelope: KernelEnvelope<TResult>;
};

export type EvaluateBlockPayload = {
  latex: string;
  displayUnit: string;
};

export type EvaluateBlockResult = {
  status: 'success' | 'error';
  resultLatex?: string;
};

export type EvaluateBlockRequest = EngineRequest<EvaluateBlockPayload>;
export type EvaluateBlockResponse = EngineResponse<EvaluateBlockResult>;

export function assertKernelEnvelope<T>(value: unknown): asserts value is KernelEnvelope<T> {
  if (!value || typeof value !== 'object') throw new TypeError('Engine response envelope must be an object.');
  const envelope = value as Record<string, unknown>;
  if (envelope.schema_version !== KERNEL_ENVELOPE_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported Kernel envelope schema version: ${String(envelope.schema_version)}.`);
  }
  if (!('result' in envelope) || !Array.isArray(envelope.diagnostics)) {
    throw new TypeError('Malformed Kernel envelope: result and diagnostics are required.');
  }
  for (const [index, item] of envelope.diagnostics.entries()) {
    if (!item || typeof item !== 'object') throw new TypeError(`diagnostics[${index}] must be an object.`);
    const diagnostic = item as Record<string, unknown>;
    if (typeof diagnostic.code !== 'string' || typeof diagnostic.message !== 'string' ||
        !['info', 'warning', 'error'].includes(String(diagnostic.severity))) {
      throw new TypeError(`diagnostics[${index}] does not match Kernel Diagnostic.`);
    }
    if (diagnostic.span != null) {
      const span = diagnostic.span as Record<string, unknown>;
      if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) ||
          Number(span.start) < 0 || Number(span.end) < Number(span.start)) {
        throw new TypeError(`diagnostics[${index}].span is not a valid half-open UTF-8 byte range.`);
      }
    }
  }
}
