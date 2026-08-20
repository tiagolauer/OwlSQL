export interface PredicateIR<
  Location extends 'join-on' | 'where' | 'having' = 'join-on' | 'where' | 'having',
  Fragment extends string = string,
> {
  kind: 'predicate';
  location: Location;
  fragment: Fragment;
}
