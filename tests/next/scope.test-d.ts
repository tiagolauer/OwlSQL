import type { TableSourceIR } from '../../src/language/ir/source.js';
import type { ResolveColumn } from '../../src/compiler/next/resolve-column.js';
import type { ResolveBinding } from '../../src/compiler/next/resolve-source.js';
import type { ChildScope, RootScope } from '../../src/compiler/next/scope.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type DB = {
  users: { id: number; name: string };
  posts: { id: string; author_id: number };
};

type Users = TableSourceIR<'users', 'u'>;
type Posts = TableSourceIR<'posts', 'p'>;
type Root = RootScope<[Users]>;

type _local = Expect<
  Equal<ResolveBinding<Root, 'u'>, { kind: 'ok'; value: Users }>
>;

type _qualified = Expect<
  Equal<ResolveColumn<DB, Root, 'u', 'id'>, { kind: 'ok'; value: number }>
>;

type _unknownAlias = Expect<
  ResolveBinding<Root, 'missing'> extends {
    kind: 'error';
    diagnostic: { code: 'UNKNOWN_ALIAS'; message: 'unknown alias: missing' };
  }
    ? true
    : false
>;

type _unknownColumn = Expect<
  ResolveColumn<DB, Root, null, 'missing'> extends {
    kind: 'error';
    diagnostic: { code: 'UNKNOWN_COLUMN'; message: 'unknown column: missing' };
  }
    ? true
    : false
>;

type _ambiguous = Expect<
  ResolveColumn<DB, RootScope<[Users, Posts]>, null, 'id'> extends {
    kind: 'error';
    diagnostic: { code: 'AMBIGUOUS_COLUMN'; message: 'ambiguous column: id' };
  }
    ? true
    : false
>;

type Child = ChildScope<[Posts], Root>;

type _correlated = Expect<
  Equal<ResolveColumn<DB, Child, 'u', 'name'>, { kind: 'ok'; value: string }>
>;

type Shadow = ChildScope<[TableSourceIR<'posts', 'u'>], Root>;

type _shadow = Expect<
  Equal<ResolveColumn<DB, Shadow, 'u', 'id'>, { kind: 'ok'; value: string }>
>;
