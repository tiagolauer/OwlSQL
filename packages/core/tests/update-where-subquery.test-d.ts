import type { StrictRow, Row, Params, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
  };
  orders: {
    id: number;
    user_id: number;
    total: number;
  };
}

type SubqueryWhereIsNotTheStatementWhere = Expect<
  Equal<
    StrictRow<DB, 'update users set name = (select name from orders where total > 5) where id = 2'>,
    Record<string, never>
  >
>;

type QualifiedSubqueryWhereResolves = Expect<
  Equal<
    StrictRow<DB, 'update users set name = (select name from orders where orders.id = 1) where id = 2'>,
    Record<string, never>
  >
>;

type OuterWhereIsStillChecked = Expect<
  Equal<
    StrictRow<DB, 'update users set name = (select name from orders where id = 1) where naem = 2'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

type OuterWhereCheckedWithoutSubquery = Expect<
  Equal<StrictRow<DB, 'update users set name = $1 where naem = 2'>, QueryTypeError<'unknown column: naem'>>
>;

type ReturningStillResolvesPastASubquery = Expect<
  Equal<
    Row<DB, 'update users set name = (select name from orders where total > 5) where id = 2 returning id, name'>,
    { id: number; name: string }
  >
>;

type DeleteSubqueryWhereStillSkipped = Expect<
  Equal<StrictRow<DB, 'delete from users where id in (select user_id from orders where total > 5)'>, Record<string, never>>
>;

// The subquery slot stays `unknown` as documented; what matters here is that
// the outer WHERE still types and the arity is right.
type ParamsUnaffectedBySubqueryWhere = Expect<
  Equal<Params<DB, 'update users set name = (select name from orders where total > $1) where id = $2'>, [unknown, number]>
>;

export type {
  SubqueryWhereIsNotTheStatementWhere,
  QualifiedSubqueryWhereResolves,
  OuterWhereIsStillChecked,
  OuterWhereCheckedWithoutSubquery,
  ReturningStillResolvesPastASubquery,
  DeleteSubqueryWhereStillSkipped,
  ParamsUnaffectedBySubqueryWhere,
};
