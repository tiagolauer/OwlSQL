export type QueryTypeError<Message extends string> = {
  readonly __sqlTypeError: Message;
};
