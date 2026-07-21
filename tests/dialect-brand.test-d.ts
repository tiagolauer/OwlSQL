import { createTypedDb, type Executor } from '../src/index.js';

interface DB {
  users: { id: number; name: string };
}

declare const executor: Executor;

export async function placeholderStyleCallSites() {
  const pgDb = createTypedDb<DB, { placeholders: 'dollar' }>(executor);
  const mysqlDb = createTypedDb<DB, { placeholders: 'question' }>(executor);
  const uncheckedDb = createTypedDb<DB>(executor);

  await pgDb.query('select id from users where id = $1', 1);

  // @ts-expect-error a dollar-style client rejects ? placeholders
  await pgDb.query('select id from users where id = ?', 1);

  await mysqlDb.query('select id from users where id = ?', 1);

  // @ts-expect-error a question-style client rejects $n placeholders
  await mysqlDb.query('select id from users where id = $1', 1);

  // @ts-expect-error a question-style client rejects @name placeholders
  await mysqlDb.query('select id from users where id = @id', 1);

  await uncheckedDb.query('select id from users where id = $1', 1);
  await uncheckedDb.query('select id from users where id = ?', 1);

  await pgDb.query('select id, name from users');

  await pgDb.query("select id from users where name = 'why?'");
}
