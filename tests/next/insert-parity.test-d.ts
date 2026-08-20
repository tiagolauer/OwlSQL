import type { ApplyLoosePolicy } from '../../src/compiler/contracts/compilation.js';
import type { InferOutput } from '../../src/compiler/next/infer-output.js';
import type {
  ResolveWriteColumn,
  ResolveWriteTarget,
} from '../../src/compiler/next/resolve-write-target.js';
import type { RootScope } from '../../src/compiler/next/scope.js';
import type { ColumnProjectionIR } from '../../src/language/ir/projection.js';
import type {
  AssignmentIR,
  OutputIR,
  WriteTargetIR,
} from '../../src/language/ir/write.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type DB = {
  users: {
    id: number;
    name: string;
  };
};

type Target = WriteTargetIR<'users', 'u'>;
type TargetSource = ResolveWriteTarget<DB, Target>;
type TargetScope = TargetSource extends { kind: 'ok'; value: infer Source }
  ? RootScope<[Source & { kind: 'table'; name: 'users'; alias: 'u'; join: 'root'; nullable: false; mergedColumns: [] }]>
  : never;

type TargetContract = Expect<
  Equal<Target, { kind: 'write-target'; name: 'users'; alias: 'u' }>
>;
type InsertColumnsContract = Expect<
  Equal<readonly ['id', 'name'] extends readonly string[] ? true : false, true>
>;
type AssignmentContract = Expect<
  Equal<AssignmentIR<'name', '$1'>, { target: 'name'; value: '$1' }>
>;
type ReturningContract = Expect<
  Equal<
    OutputIR<'returning', [ColumnProjectionIR<null, 'id', 'id'>]>,
    { mode: 'returning'; projections: [ColumnProjectionIR<null, 'id', 'id'>] }
  >
>;
type OutputContract = Expect<
  Equal<
    OutputIR<'output', [ColumnProjectionIR<null, 'name', 'name'>]>,
    { mode: 'output'; projections: [ColumnProjectionIR<null, 'name', 'name'>] }
  >
>;
type NoOutputContract = Expect<Equal<OutputIR, { mode: 'none'; projections: [] }>>;
type ResolveTargetContract = Expect<
  Equal<TargetSource['kind'], 'ok'>
>;
type ResolveColumnContract = Expect<
  Equal<ResolveWriteColumn<DB, Target, 'name'>, { kind: 'ok'; value: string }>
>;
type UnknownColumnContract = Expect<
  Equal<ResolveWriteColumn<DB, Target, 'nope'>['kind'], 'error'>
>;
type ReturningInference = Expect<
  Equal<
    ApplyLoosePolicy<
      InferOutput<
        DB,
        TargetScope,
        OutputIR<'returning', [ColumnProjectionIR<null, 'id', 'id'>]>
      >
    >,
    { id: number }[]
  >
>;
type NoOutputInference = Expect<
  Equal<
    ApplyLoosePolicy<InferOutput<DB, TargetScope, OutputIR>>,
    Record<string, never>[]
  >
>;

export type InsertContractLock = [
  TargetContract,
  InsertColumnsContract,
  AssignmentContract,
  ReturningContract,
  OutputContract,
  NoOutputContract,
  ResolveTargetContract,
  ResolveColumnContract,
  UnknownColumnContract,
  ReturningInference,
  NoOutputInference,
];
