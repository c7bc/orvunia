export type AnswerPreparationOptions = Readonly<{
  requestFingerprint?: string;
  instructionTransform?: (instructions: string) => string;
}>;
