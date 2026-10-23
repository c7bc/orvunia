import { and, eq } from "drizzle-orm";
import type { OperationKind } from "../../operations/domain.ts";
import { operations } from "./operation-schema.ts";
export const operationWhere = (
  workspaceId: string,
  kind: OperationKind,
  id: string,
) =>
  and(
    eq(operations.workspaceId, workspaceId),
    eq(operations.kind, kind),
    eq(operations.id, id),
  );
