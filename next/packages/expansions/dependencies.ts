import type { AnswerDependencies } from "../answers/dependencies.ts";
import type { ExpansionRepository } from "./repository.ts";
export type ExpansionDependencies = AnswerDependencies & {
  stages: ExpansionRepository;
};
