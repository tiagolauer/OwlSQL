export interface PredicateIR<
  Location extends 'join-on' | 'where' | 'having' = 'where',
  Fragment extends string = string,
> {
  kind: 'predicate';
  location: Location;
  fragment: Fragment;
}
