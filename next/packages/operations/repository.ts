import type {
  Operation,
  OperationFailure,
  OperationKind,
  OperationResult,
} from "./domain.ts";

export interface OperationRepository {
  find(
    workspaceId: string,
    kind: OperationKind,
    id: string,
  ): Promise<Operation | null>;
  claim(candidate: Operation): Promise<Operation>;
  start(
    workspaceId: string,
    kind: OperationKind,
    id: string,
    lease: string,
    reservationId: string,
  ): Promise<Operation>;
  renew(
    workspaceId: string,
    kind: OperationKind,
    id: string,
    lease: string,
    now: number,
  ): Promise<boolean>;
  fail(
    workspaceId: string,
    kind: OperationKind,
    id: string,
    lease: string,
    failure: OperationFailure,
  ): Promise<Operation>;
  complete(
    workspaceId: string,
    kind: OperationKind,
    id: string,
    lease: string,
    result: OperationResult,
    now: string,
  ): Promise<Operation>;
  cancel(workspaceId: string, conversationId: string): Promise<void>;
  recover(now: number): Promise<void>;
}
