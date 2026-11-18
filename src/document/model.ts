/**
 * Jabr authored document model v1.
 *
 * This module is deliberately independent of BlockSuite and of calculation
 * execution. The BlockSuite adapter maps each persisted model.id to BlockId
 * and stores only authored payloads in Yjs. Derived values/results belong to
 * the Engine and must not be added to these records.
 */

export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type BlockId = string & { readonly __brand: 'BlockId' };
export type DeclarationId = string & { readonly __brand: 'DeclarationId' };
export type TableRowId = string & { readonly __brand: 'TableRowId' };
export type TableColumnId = string & { readonly __brand: 'TableColumnId' };
export type TableCellId = string & { readonly __brand: 'TableCellId' };
export type MatrixEntryId = string & { readonly __brand: 'MatrixEntryId' };
export type LayoutColumnId = string & { readonly __brand: 'LayoutColumnId' };
export type LayoutRowId = string & { readonly __brand: 'LayoutRowId' };
export type FunctionParameterId = string & { readonly __brand: 'FunctionParameterId' };
export type ScopeId = string & { readonly __brand: 'ScopeId' };
export type LogicBranchId = string & { readonly __brand: 'LogicBranchId' };

export const DOCUMENT_SCHEMA_VERSION = 1 as const;

export function createStableId<T extends string>(): T {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('A cryptographically secure UUID generator is required.');
  }
  return globalThis.crypto.randomUUID() as T;
}

export const createDocumentId = (): DocumentId => createStableId<DocumentId>();
export const createBlockId = (): BlockId => createStableId<BlockId>();
export const createDeclarationId = (): DeclarationId => createStableId<DeclarationId>();
export const createTableRowId = (): TableRowId => createStableId<TableRowId>();
export const createTableColumnId = (): TableColumnId => createStableId<TableColumnId>();
export const createTableCellId = (): TableCellId => createStableId<TableCellId>();
export const createMatrixEntryId = (): MatrixEntryId => createStableId<MatrixEntryId>();
export const createLayoutColumnId = (): LayoutColumnId => createStableId<LayoutColumnId>();
export const createLayoutRowId = (): LayoutRowId => createStableId<LayoutRowId>();
export const createFunctionParameterId = (): FunctionParameterId => createStableId<FunctionParameterId>();
export const createScopeId = (): ScopeId => createStableId<ScopeId>();
export const createLogicBranchId = (): LogicBranchId => createStableId<LogicBranchId>();

export interface JabrDocumentV1 {
  readonly schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
  readonly documentId: DocumentId;
  readonly title: string;
  readonly blocks: readonly DocumentBlock[];
}

export type DocumentBlock =
  | HeadingBlock
  | TextMarkdownBlock
  | TableBlock
  | MatrixBlock
  | AssignBlock
  | ExprBlock
  | LogicBlock
  | FuncBlock
  | CheckBlock
  | ColumnLayoutBlock;

export interface BlockBase<K extends string> {
  readonly id: BlockId;
  readonly type: K;
}

export interface HeadingBlock extends BlockBase<'heading'> {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
}

export interface TextMarkdownBlock extends BlockBase<'text'> {
  readonly markdown: string;
}

export type TableValueType = 'text' | 'number' | 'boolean' | 'quantity' | 'expression';

export interface TableColumn {
  readonly id: TableColumnId;
  readonly name: string;
  readonly valueType: TableValueType;
  /** Authored display/unit symbol only; mathematical interpretation belongs to Jabr Math. */
  readonly unitSymbol?: string;
}

export interface TableCell {
  readonly id: TableCellId;
  readonly columnId: TableColumnId;
  /** Canonical authored cell content. Parsing/evaluation is outside this model. */
  readonly source: string;
}

export interface TableRow {
  readonly id: TableRowId;
  readonly cells: readonly TableCell[];
}

export interface TableBlock extends BlockBase<'table'> {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
}

export interface MatrixEntry {
  readonly id: MatrixEntryId;
  readonly source: string;
}

export interface MatrixBlock extends BlockBase<'matrix'> {
  readonly rowCount: number;
  readonly columnCount: number;
  /** Row-major entries; length must equal rowCount * columnCount. */
  readonly entries: readonly MatrixEntry[];
}

export type AssignmentInitializer =
  | { readonly kind: 'literal'; readonly source: string }
  | { readonly kind: 'expression'; readonly source: string };

export interface AssignBlock extends BlockBase<'assign'> {
  readonly declarationId: DeclarationId;
  readonly identifier: string;
  readonly initializer: AssignmentInitializer;
}

export interface ExprBlock extends BlockBase<'expr'> {
  readonly source: string;
  /** Present only when the expression declares a named result. */
  readonly resultBinding?: {
    readonly declarationId: DeclarationId;
    readonly identifier: string;
  };
}

export type LogicKind = 'if' | 'for' | 'while' | 'match';

export interface LogicBranch {
  readonly id: LogicBranchId;
  readonly conditionSource?: string;
  readonly blocks: readonly DocumentBlock[];
}

export interface LogicBlock extends BlockBase<'logic'> {
  readonly scopeId: ScopeId;
  readonly kind: LogicKind;
  readonly branches: readonly LogicBranch[];
  /** Explicit declarations exported from this child scope. */
  readonly exports: readonly DeclarationId[];
}

export interface FunctionParameter {
  readonly id: FunctionParameterId;
  readonly name: string;
}

export interface FuncBlock extends BlockBase<'func'> {
  readonly declarationId: DeclarationId;
  readonly scopeId: ScopeId;
  readonly name: string;
  readonly parameters: readonly FunctionParameter[];
  readonly body: readonly DocumentBlock[];
}

export interface CheckBlock extends BlockBase<'check'> {
  readonly checkKind: string;
  readonly label: string;
  readonly expressionSource: string;
}

export interface LayoutColumn {
  readonly id: LayoutColumnId;
  /** Relative width. Omitted means equal/default sizing. */
  readonly width?: number;
}

export interface LayoutCell {
  readonly columnIndex: number;
  readonly blocks: readonly DocumentBlock[];
}

export interface LayoutRow {
  readonly id: LayoutRowId;
  /** Cells are stored left-to-right in strictly increasing columnIndex order. */
  readonly cells: readonly LayoutCell[];
}

/**
 * Composition only: it introduces neither a calculation node nor a lexical
 * scope. Rows are traversed top-to-bottom; cells within a row left-to-right.
 */
export interface ColumnLayoutBlock extends BlockBase<'column-layout'> {
  readonly columns: readonly LayoutColumn[];
  readonly rows: readonly LayoutRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
}

/** Preserve the native BlockSuite model identity; never mint a replacement during adaptation. */
export function blockIdFromBlockSuiteModelId(modelId: string): BlockId {
  requireString(modelId, 'BlockSuite model.id');
  return modelId as BlockId;
}

function requireArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
}

function requireUnique(value: string, set: Set<string>, path: string): void {
  requireString(value, path);
  if (set.has(value)) throw new Error(`${path} must be unique; duplicate "${value}".`);
  set.add(value);
}

const DERIVED_PROPERTY_NAMES = new Set([
  'result', 'resultLatex', 'calculatedValue', 'evaluation', 'evaluationResult',
  'status', 'diagnostics', 'diagnostic', 'requestId', 'sourceRevision',
  'calculationGeneration', 'executionGeneration', 'worksheetExecutionId',
  'snapshot', 'snapshotRef', 'derived', 'derivedPayload', 'renderCache',
  'cacheFingerprint',
]);

function assertNoDerivedProperties(value: unknown, path = 'document'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoDerivedProperties(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (DERIVED_PROPERTY_NAMES.has(key)) {
      throw new Error(`${path}.${key} is derived state and cannot be persisted in the authored document.`);
    }
    assertNoDerivedProperties(child, `${path}.${key}`);
  }
}

function childrenOf(block: DocumentBlock): readonly DocumentBlock[] {
  switch (block.type) {
    case 'logic':
      return block.branches.flatMap(branch => [...branch.blocks]);
    case 'func':
      return block.body;
    case 'column-layout':
      return block.rows.flatMap(row => row.cells.flatMap(cell => [...cell.blocks]));
    default:
      return [];
  }
}

/** Stable visual/document reading order, including non-calculation blocks. */
export function getDocumentReadingOrder(document: JabrDocumentV1): DocumentBlock[] {
  const ordered: DocumentBlock[] = [];
  const visit = (blocks: readonly DocumentBlock[]) => {
    for (const block of blocks) {
      ordered.push(block);
      visit(childrenOf(block));
    }
  };
  visit(document.blocks);
  return ordered;
}

/** Validates the authored v1 tree and all persistent identities. */
export function assertValidDocument(value: unknown): asserts value is JabrDocumentV1 {
  if (!isRecord(value)) throw new Error('Document must be an object.');
  assertNoDerivedProperties(value);
  if (value.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported document schema version: ${String(value.schemaVersion)}.`);
  }
  requireString(value.documentId, 'document.documentId');
  if (typeof value.title !== 'string') throw new Error('document.title must be a string.');
  requireArray(value.blocks, 'document.blocks');

  const blockIds = new Set<string>();
  const declarationIds = new Set<string>();
  const parameterIds = new Set<string>();
  const auxiliaryIds = new Set<string>();

  const visit = (blocks: unknown[], path: string): void => {
    blocks.forEach((raw, index) => {
      const at = `${path}[${index}]`;
      if (!isRecord(raw)) throw new Error(`${at} must be an object.`);
      requireUnique(raw.id as string, blockIds, `${at}.id`);
      requireString(raw.type, `${at}.type`);

      const visitChildren = (children: unknown, childPath: string) => {
        requireArray(children, childPath);
        visit(children, childPath);
      };

      switch (raw.type) {
        case 'heading':
          if (![1, 2, 3, 4, 5, 6].includes(raw.level as number)) throw new Error(`${at}.level is invalid.`);
          if (typeof raw.text !== 'string') throw new Error(`${at}.text must be a string.`);
          break;
        case 'text':
          if (typeof raw.markdown !== 'string') throw new Error(`${at}.markdown must be a string.`);
          break;
        case 'table': {
          requireArray(raw.columns, `${at}.columns`);
          requireArray(raw.rows, `${at}.rows`);
          const columns = new Set<string>();
          for (const [columnIndex, column] of raw.columns.entries()) {
            if (!isRecord(column)) throw new Error(`${at}.columns[${columnIndex}] must be an object.`);
            requireUnique(column.id as string, columns, `${at}.columns[${columnIndex}].id`);
            requireUnique(column.id as string, auxiliaryIds, `${at}.columns[${columnIndex}].id`);
            requireString(column.name, `${at}.columns[${columnIndex}].name`);
            if (!['text', 'number', 'boolean', 'quantity', 'expression'].includes(String(column.valueType))) {
              throw new Error(`${at}.columns[${columnIndex}].valueType is invalid.`);
            }
          }
          const rowIds = new Set<string>();
          for (const [rowIndex, row] of raw.rows.entries()) {
            if (!isRecord(row)) throw new Error(`${at}.rows[${rowIndex}] must be an object.`);
            requireUnique(row.id as string, rowIds, `${at}.rows[${rowIndex}].id`);
            requireUnique(row.id as string, auxiliaryIds, `${at}.rows[${rowIndex}].id`);
            requireArray(row.cells, `${at}.rows[${rowIndex}].cells`);
            const cellColumns = new Set<string>();
            for (const [cellIndex, cell] of row.cells.entries()) {
              if (!isRecord(cell)) throw new Error(`${at}.rows[${rowIndex}].cells[${cellIndex}] must be an object.`);
              requireUnique(cell.id as string, auxiliaryIds, `${at}.rows[${rowIndex}].cells[${cellIndex}].id`);
              requireString(cell.columnId, `${at}.rows[${rowIndex}].cells[${cellIndex}].columnId`);
              if (!columns.has(cell.columnId)) throw new Error(`${at}.rows[${rowIndex}] references an unknown column.`);
              requireUnique(cell.columnId, cellColumns, `${at}.rows[${rowIndex}].cells[${cellIndex}].columnId`);
              if (typeof cell.source !== 'string') throw new Error(`${at}.rows[${rowIndex}].cells[${cellIndex}].source must be a string.`);
            }
          }
          break;
        }
        case 'matrix': {
          if (!Number.isInteger(raw.rowCount) || (raw.rowCount as number) < 0 ||
              !Number.isInteger(raw.columnCount) || (raw.columnCount as number) < 0) {
            throw new Error(`${at} matrix dimensions must be non-negative integers.`);
          }
          requireArray(raw.entries, `${at}.entries`);
          if (raw.entries.length !== (raw.rowCount as number) * (raw.columnCount as number)) {
            throw new Error(`${at}.entries length must equal rowCount * columnCount.`);
          }
          raw.entries.forEach((entry, entryIndex) => {
            if (!isRecord(entry)) throw new Error(`${at}.entries[${entryIndex}] must be an object.`);
            requireUnique(entry.id as string, auxiliaryIds, `${at}.entries[${entryIndex}].id`);
            if (typeof entry.source !== 'string') throw new Error(`${at}.entries[${entryIndex}].source must be a string.`);
          });
          break;
        }
        case 'assign':
          requireUnique(raw.declarationId as string, declarationIds, `${at}.declarationId`);
          requireString(raw.identifier, `${at}.identifier`);
          if (!isRecord(raw.initializer) || !['literal', 'expression'].includes(String(raw.initializer.kind)) ||
              typeof raw.initializer.source !== 'string') throw new Error(`${at}.initializer is invalid.`);
          break;
        case 'expr':
          requireString(raw.source, `${at}.source`);
          if (raw.resultBinding !== undefined) {
            if (!isRecord(raw.resultBinding)) throw new Error(`${at}.resultBinding is invalid.`);
            requireUnique(raw.resultBinding.declarationId as string, declarationIds, `${at}.resultBinding.declarationId`);
            requireString(raw.resultBinding.identifier, `${at}.resultBinding.identifier`);
          }
          break;
        case 'logic': {
          requireUnique(raw.scopeId as string, auxiliaryIds, `${at}.scopeId`);
          if (!['if', 'for', 'while', 'match'].includes(String(raw.kind))) throw new Error(`${at}.kind is invalid.`);
          requireArray(raw.branches, `${at}.branches`);
          requireArray(raw.exports, `${at}.exports`);
          raw.branches.forEach((branch, branchIndex) => {
            if (!isRecord(branch)) throw new Error(`${at}.branches[${branchIndex}] must be an object.`);
            requireUnique(branch.id as string, auxiliaryIds, `${at}.branches[${branchIndex}].id`);
            visitChildren(branch.blocks, `${at}.branches[${branchIndex}].blocks`);
          });
          raw.exports.forEach((id, exportIndex) => requireString(id, `${at}.exports[${exportIndex}]`));
          break;
        }
        case 'func':
          requireUnique(raw.declarationId as string, declarationIds, `${at}.declarationId`);
          requireUnique(raw.scopeId as string, auxiliaryIds, `${at}.scopeId`);
          requireString(raw.name, `${at}.name`);
          requireArray(raw.parameters, `${at}.parameters`);
          raw.parameters.forEach((parameter, parameterIndex) => {
            if (!isRecord(parameter)) throw new Error(`${at}.parameters[${parameterIndex}] must be an object.`);
            requireUnique(parameter.id as string, parameterIds, `${at}.parameters[${parameterIndex}].id`);
            requireString(parameter.name, `${at}.parameters[${parameterIndex}].name`);
          });
          visitChildren(raw.body, `${at}.body`);
          break;
        case 'check':
          requireString(raw.checkKind, `${at}.checkKind`);
          if (typeof raw.label !== 'string') throw new Error(`${at}.label must be a string.`);
          requireString(raw.expressionSource, `${at}.expressionSource`);
          break;
        case 'column-layout': {
          requireArray(raw.columns, `${at}.columns`);
          requireArray(raw.rows, `${at}.rows`);
          const layoutColumns = raw.columns as unknown[];
          if (layoutColumns.length < 2) throw new Error(`${at}.columns must contain at least two columns.`);
          const columnIds = new Set<string>();
          raw.columns.forEach((column, columnIndex) => {
            if (!isRecord(column)) throw new Error(`${at}.columns[${columnIndex}] must be an object.`);
            requireUnique(column.id as string, columnIds, `${at}.columns[${columnIndex}].id`);
            requireUnique(column.id as string, auxiliaryIds, `${at}.columns[${columnIndex}].id`);
            if (column.width !== undefined && (typeof column.width !== 'number' || !Number.isFinite(column.width) || column.width <= 0)) {
              throw new Error(`${at}.columns[${columnIndex}].width must be a positive finite number.`);
            }
          });
          raw.rows.forEach((row, rowIndex) => {
            if (!isRecord(row)) throw new Error(`${at}.rows[${rowIndex}] must be an object.`);
            requireUnique(row.id as string, auxiliaryIds, `${at}.rows[${rowIndex}].id`);
            requireArray(row.cells, `${at}.rows[${rowIndex}].cells`);
            let previousColumn = -1;
            const seenColumns = new Set<number>();
            row.cells.forEach((cell, cellIndex) => {
              if (!isRecord(cell)) throw new Error(`${at}.rows[${rowIndex}].cells[${cellIndex}] must be an object.`);
              if (!Number.isInteger(cell.columnIndex) || (cell.columnIndex as number) < 0 ||
                  (cell.columnIndex as number) >= layoutColumns.length) {
                throw new Error(`${at}.rows[${rowIndex}].cells[${cellIndex}].columnIndex is invalid.`);
              }
              const columnIndex = cell.columnIndex as number;
              if (columnIndex <= previousColumn || seenColumns.has(columnIndex)) {
                throw new Error(`${at}.rows[${rowIndex}].cells must be ordered left-to-right with no duplicate column.`);
              }
              previousColumn = columnIndex;
              seenColumns.add(columnIndex);
              visitChildren(cell.blocks, `${at}.rows[${rowIndex}].cells[${cellIndex}].blocks`);
            });
          });
          break;
        }
        default:
          throw new Error(`${at}.type "${String(raw.type)}" is not supported by document schema v1.`);
      }
    });
  };

  visit(value.blocks, 'document.blocks');
}

/** JSON serialization is allowed only for a validated authored document. */
export function serializeDocument(document: JabrDocumentV1): string {
  assertValidDocument(document);
  return JSON.stringify(document);
}

/** Parses only the explicitly supported schema version; migrations are separate adapters. */
export function deserializeDocument(serialized: string): JabrDocumentV1 {
  const parsed: unknown = JSON.parse(serialized);
  assertValidDocument(parsed);
  return parsed;
}
