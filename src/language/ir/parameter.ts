export type ParameterStyle = 'numbered' | 'named' | 'positional';

export interface ParameterIR<
  Token extends string = string,
  Style extends ParameterStyle = ParameterStyle,
  Identity extends string = string,
  Fragment extends string = string,
> {
  kind: 'parameter';
  token: Token;
  style: Style;
  identity: Identity;
  context: Fragment;
}
