import { LocalModelError } from "../local-models/domain.ts";
import { OperationPreparationError } from "../operations/preparation-error.ts";

export async function invokeGeneration<Result>(invoke: () => Promise<Result>): Promise<Result> {
  try { return await invoke(); }
  catch (error) {
    // The local capacity guard rejects before issuing any generation request.
    if (error instanceof LocalModelError && ["runtime_busy", "runtime_not_loaded"].includes(error.code))
      throw new OperationPreparationError(error);
    throw error;
  }
}
