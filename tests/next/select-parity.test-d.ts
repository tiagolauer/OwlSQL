import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type {
  NextQuery,
  NextInferParams,
  NextRow,
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
    active: boolean;
    age: number;
  };
  posts: {
    id: number;
    user_id: number;
    title: string;
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

type _innerJoin = Expect<Equal<
  LegacyInferResult<DB, 'select u.id, p.title from users u join posts p on u.id = p.user_id'>,
  NextQuery<DB, 'select u.id, p.title from users u join posts p on u.id = p.user_id'>
>>;

type _leftJoin = Expect<Equal<
  LegacyInferResult<DB, 'select u.name, p.title from users u left join posts p on u.id = p.user_id'>,
  NextQuery<DB, 'select u.name, p.title from users u left join posts p on u.id = p.user_id'>
>>;

type _rightJoin = Expect<Equal<
  LegacyInferResult<DB, 'select u.name, p.title from users u right join posts p on u.id = p.user_id'>,
  NextQuery<DB, 'select u.name, p.title from users u right join posts p on u.id = p.user_id'>
>>;

type _fullJoin = Expect<Equal<
  LegacyInferResult<DB, 'select u.name, p.title from users u full join posts p on u.id = p.user_id'>,
  NextQuery<DB, 'select u.name, p.title from users u full join posts p on u.id = p.user_id'>
>>;

type _using = Expect<Equal<
  LegacyInferResultStrict<DB, 'select id from users join posts using (id)'>,
  NextStrictQuery<DB, 'select id from users join posts using (id)'>
>>;

type _onAmbiguity = Expect<Equal<
  LegacyInferResultStrict<DB, 'select id from users join posts on users.id = posts.id'>,
  NextStrictQuery<DB, 'select id from users join posts on users.id = posts.id'>
>>;

type _derived = Expect<Equal<
  LegacyInferResult<DB, 'select recent.id from (select id from users) recent'>,
  NextQuery<DB, 'select recent.id from (select id from users) recent'>
>>;

type _star = Expect<Equal<
  LegacyInferResult<DB, 'select * from users'>,
  NextQuery<DB, 'select * from users'>
>>;

type _qualifiedStar = Expect<Equal<
  LegacyInferResult<DB, 'select u.* from users u'>,
  NextQuery<DB, 'select u.* from users u'>
>>;

type _aggregates = Expect<Equal<
  LegacyInferResult<DB, 'select count(*) as total, max(age) as oldest from users'>,
  NextQuery<DB, 'select count(*) as total, max(age) as oldest from users'>
>>;

type _function = Expect<Equal<
  LegacyInferResult<DB, 'select lower(name) as handle from users'>,
  NextQuery<DB, 'select lower(name) as handle from users'>
>>;

type _case = Expect<Equal<
  LegacyInferResult<DB, "select case when active then 'yes' else 'no' end as status from users">,
  NextQuery<DB, "select case when active then 'yes' else 'no' end as status from users">
>>;

type _cast = Expect<Equal<
  LegacyInferResult<DB, 'select id::text as id_text from users'>,
  NextQuery<DB, 'select id::text as id_text from users'>
>>;

type _literal = Expect<Equal<
  LegacyInferResult<DB, "select 1 as one, 'x' as tag, true as flag, null as nothing">,
  NextQuery<DB, "select 1 as one, 'x' as tag, true as flag, null as nothing">
>>;

type _unsupportedExpression = Expect<Equal<
  LegacyInferResult<DB, 'select id * 2 as doubled from users'>,
  NextQuery<DB, 'select id * 2 as doubled from users'>
>>;

type _strictFunctionError = Expect<Equal<
  LegacyInferResultStrict<DB, 'select max(naem) as oldest from users'>,
  NextStrictQuery<DB, 'select max(naem) as oldest from users'>
>>;

type _commonFunctions = Expect<Equal<
  LegacyInferResult<DB, 'select concat(name, name) as full_name, now() as created from users'>,
  NextQuery<DB, 'select concat(name, name) as full_name, now() as created from users'>
>>;

type _unaliasedFunction = Expect<Equal<
  LegacyInferResult<DB, 'select count(*) from users'>,
  NextQuery<DB, 'select count(*) from users'>
>>;

type _nestedCase = Expect<Equal<
  LegacyInferResult<DB, "select case when active then case when age < 18 then 'minor' else 'adult' end else 'inactive' end as status from users">,
  NextQuery<DB, "select case when active then case when age < 18 then 'minor' else 'adult' end else 'inactive' end as status from users">
>>;

type _parenthesizedColumn = Expect<Equal<
  LegacyInferResult<DB, 'select (u.name) as handle from users u'>,
  NextQuery<DB, 'select (u.name) as handle from users u'>
>>;

type _window = Expect<Equal<
  LegacyInferResult<DB, 'select row_number() over (order by id) as rn from users'>,
  NextQuery<DB, 'select row_number() over (order by id) as rn from users'>
>>;

type _strictCastError = Expect<Equal<
  LegacyInferResultStrict<DB, 'select naem::text as value from users'>,
  NextStrictQuery<DB, 'select naem::text as value from users'>
>>;

type _leftJoinStar = Expect<Equal<
  LegacyInferResult<DB, 'select * from users u left join posts p on u.id = p.user_id'>,
  NextQuery<DB, 'select * from users u left join posts p on u.id = p.user_id'>
>>;

type _where = Expect<Equal<
  LegacyInferResultStrict<DB, 'select id from users where age > 18 and active = true'>,
  NextStrictQuery<DB, 'select id from users where age > 18 and active = true'>
>>;

type _whereTypo = Expect<Equal<
  LegacyInferResultStrict<DB, 'select id from users where naem = $1'>,
  NextStrictQuery<DB, 'select id from users where naem = $1'>
>>;

type _comparisonParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where id = $1 and name = $2'>,
  NextInferParams<DB, 'select id from users where id = $1 and name = $2'>
>>;

type _predicateParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where name like $1 or name ilike $2 or id in ($3)'>,
  NextInferParams<DB, 'select id from users where name like $1 or name ilike $2 or id in ($3)'>
>>;

type _betweenParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where age between $1 and $2'>,
  NextInferParams<DB, 'select id from users where age between $1 and $2'>
>>;

type _arrayParam = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where id = any($1)'>,
  NextInferParams<DB, 'select id from users where id = any($1)'>
>>;

type _namedParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where id = @id or name = :name'>,
  NextInferParams<DB, 'select id from users where id = @id or name = :name'>
>>;

type _questionParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where id = ? and active = ?'>,
  NextInferParams<DB, 'select id from users where id = ? and active = ?'>
>>;

type _conflictingParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users where id = $1 or name = $1'>,
  NextInferParams<DB, 'select id from users where id = $1 or name = $1'>
>>;

type _limitOffsetParams = Expect<Equal<
  LegacyInferParams<DB, 'select id from users limit $1 offset $2'>,
  NextInferParams<DB, 'select id from users limit $1 offset $2'>
>>;

type _groupHaving = Expect<Equal<
  LegacyInferResult<DB, 'select active, count(*) as total from users group by active having count(*) > 1 order by active'>,
  NextQuery<DB, 'select active, count(*) as total from users group by active having count(*) > 1 order by active'>
>>;

type _havingParams = Expect<Equal<
  LegacyInferParams<DB, 'select active from users group by active having count(*) > $1'>,
  NextInferParams<DB, 'select active from users group by active having count(*) > $1'>
>>;

type _union = Expect<Equal<
  LegacyInferResult<DB, 'select id from users union all select user_id as id from posts'>,
  NextQuery<DB, 'select id from users union all select user_id as id from posts'>
>>;

type _literalSetOperations = Expect<Equal<
  LegacyInferResult<DB, 'select 1 as value intersect select 1 except select 2'>,
  NextQuery<DB, 'select 1 as value intersect select 1 except select 2'>
>>;

type _setRow = Expect<Equal<
  NextRow<DB, 'select 1 as value union select 2'>,
  { value: number }
>>;
