import { createTypedDb, type Executor } from '../src/index.js';
import { createKyselyExecutor } from '../src/adapters/kysely.js';
import type { Kysely } from 'kysely';

interface DB {
  users: { id: number; name: string };
}

declare const executor: Executor;
declare const kysely: Kysely<{ users: { id: number; name: string } }>;

export async function placeholderStyleCallSites() {
  const pgDb = createTypedDb<DB, { placeholders: 'dollar' }>(executor);
  const mysqlDb = createTypedDb<DB, { placeholders: 'question' }>(executor);
  const uncheckedDb = createTypedDb<DB>(executor);

  await pgDb.query('select id from users where id = $1', 1);

  // @ts-expect-error a dollar-style client rejects ? placeholders
  await pgDb.query('select id from users where id = ?', 1);

  await mysqlDb.query('select id from users where id = ?', 1);

  await mysqlDb.query(
    'select id from users where name = ? and id in (select 1 where $$x$$ = $$x$$)',
    'ada',
  );

  await mysqlDb.query(
    'select id from users where name = ? and id in (select 1 where $tag$x$tag$ = $tag$x$tag$)',
    'ada',
  );

  await mysqlDb.query(
    'select id from users where name = ? and note = $$this body mentions $1$$',
    'ada',
  );

  await mysqlDb.query(
    'select id from users where name = ? and note = $tag$this body mentions $1$tag$',
    'ada',
  );

  // @ts-expect-error a question-style client still rejects $n placeholders outside dollar-quoted bodies
  await mysqlDb.query('select id from users where id = $1 and note = $$x$$', 1);

  // @ts-expect-error a question-style client rejects $n placeholders
  await mysqlDb.query('select id from users where id = $1', 1);

  // @ts-expect-error a question-style client rejects @name placeholders
  await mysqlDb.query('select id from users where id = @id', 1);

  // Regression for #298: `$action` used to be stripped as a substring, so a
  // name that merely starts with it left no dollar token behind, the query
  // reported no placeholder style at all, and it passed the brand check for
  // every dialect - while Params still demanded a value for it. No driver but
  // Postgres can bind a `$name`.
  // @ts-expect-error a question-style client rejects a $actionType placeholder
  await mysqlDb.query('select id from users where name = $actionType', 'x');

  // @ts-expect-error the underscore spelling is a name too
  await mysqlDb.query('select id from users where name = $action_id', 'x');

  // @ts-expect-error and so is a plain suffix
  await mysqlDb.query('select id from users where name = $actionable', 'x');

  await pgDb.query('select id from users where name = $actionType', 'x');

  await uncheckedDb.query('select id from users where id = $1', 1);
  await uncheckedDb.query('select id from users where id = ?', 1);

  await pgDb.query('select id, name from users');

  await pgDb.query("select id from users where name = 'why?'");

  // Placeholder-style checking is driven entirely by the `placeholders`
  // option passed to createTypedDb, not by anything the adapter itself
  // declares - so it already applies to Kysely (or any adapter) the same
  // way, with no special-casing needed (#161).
  const kyselyMysqlDb = createTypedDb<DB, { placeholders: 'question' }>(
    createKyselyExecutor(kysely),
  );

  await kyselyMysqlDb.query('select id from users where id = ?', 1);

  // @ts-expect-error a question-style client rejects $n placeholders, even
  // through the Kysely adapter
  await kyselyMysqlDb.query('select id from users where id = $1', 1);
}
