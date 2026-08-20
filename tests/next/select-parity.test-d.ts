import type {
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type {
  NextQuery,
  NextStrictQuery,
} from '../../src/compiler/next/index.js';

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

type _simple = Expect<Equal<
  LegacyInferResult<DB, 'select id, name from users'>,
  NextQuery<DB, 'select id, name from users'>
>>;

type _aliased = Expect<Equal<
  LegacyInferResult<DB, 'select id from users u'>,
  NextQuery<DB, 'select id from users u'>
>>;

type _qualified = Expect<Equal<
  LegacyInferResult<DB, 'select u.id from users as u'>,
  NextQuery<DB, 'select u.id from users as u'>
>>;

type _renamed = Expect<Equal<
  LegacyInferResult<DB, 'select u.id as user_id from users u'>,
  NextQuery<DB, 'select u.id as user_id from users u'>
>>;

type _unknownLoose = Expect<Equal<
  LegacyInferResult<DB, 'select nope from users'>,
  NextQuery<DB, 'select nope from users'>
>>;

type _unknownStrict = Expect<Equal<
  LegacyInferResultStrict<DB, 'select nope from users'>,
  NextStrictQuery<DB, 'select nope from users'>
>>;
