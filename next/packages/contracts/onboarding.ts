import { z } from "zod";
export const onboardingSchema = z
  .object({
    version: z.literal(1).default(1),
    completed: z.boolean().default(false),
    skipped: z.boolean().default(false),
    persona: z
      .enum(["job", "student", "professional", "curious", ""])
      .default(""),
    goal: z.string().max(160).default(""),
    industry: z.string().max(100).default(""),
    discovery: z.string().max(100).default(""),
    experience: z.string().max(80).default(""),
    mode: z.enum(["recruiter", "technical"]).default("recruiter"),
    output: z.string().max(12).default("pt-BR"),
    code: z.string().max(40).default("TypeScript"),
    tutorialComplete: z.boolean().default(false),
  })
  .strict();
