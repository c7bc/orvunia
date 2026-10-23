export class OperationPreparationError extends Error {
  constructor(readonly reason: unknown) {
    super("Operation preparation failed", { cause: reason });
  }
}

export async function prepareInvocation<Result>(prepare: () => Promise<Result>): Promise<Result> {
  try { return await prepare(); }
  catch (error) { throw new OperationPreparationError(error); }
}
