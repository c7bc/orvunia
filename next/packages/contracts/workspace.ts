import { z } from "zod";
import { modeSchema } from "./modes.ts";
export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    role: z.string().trim().min(1).max(100),
    job: z.string().trim().min(1).max(120),
    company: z.string().max(100),
    tags: z.string().max(200),
    experience: z.string().max(15000),
    description: z.string().max(15000),
  })
  .strict();
export const codeLanguages = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Kotlin",
  "Swift",
  "SQL",
  "Ruby",
] as const;
export const preferencesSchema = z
  .object({
    output: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
    audio: z
      .union([z.literal("auto"), z.string().regex(/^[a-z]{2}$/)])
      .default("pt"),
    code: z.enum(codeLanguages),
    source: z.enum(["microphone", "display"]).default("microphone"),
    instructions: z.string().max(3000).default(""),
    modeInstructions: z
      .object({
        recruiter: z.string().max(3000),
        technical: z.string().max(3000),
      })
      .strict()
      .default({ recruiter: "", technical: "" }),
    noteTemplates: z
      .object({
        recruiter: z.string().max(3000),
        technical: z.string().max(3000),
      })
      .strict()
      .default({ recruiter: "", technical: "" }),
  })
  .strict();
export const librarySchema = z
  .object({
    documents: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(160),
            mode: modeSchema.optional(),
            text: z.string().max(30000),
            date: z.string().max(40),
          })
          .strict(),
      )
      .max(15),
    prompts: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().min(1).max(100),
            instructions: z.string().min(1).max(6000),
            mode: modeSchema,
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
