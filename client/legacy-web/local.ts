import type {
  Capture,
  Preferences,
  SessionReport,
  Transcript,
} from "./models.js";
import { readProfile } from "./responses.js";
import { array, number, record, text } from "./validation.js";
import type { WorkspaceState } from "./workspace-types.js";
function readTranscript(value: unknown): Transcript {
  const item = record(value);
  return {
    ...item,
    who: text(item.who),
    time: text(item.time),
    text: text(item.text),
  };
}
function readCapture(value: unknown): Capture {
  const item = record(value);
  return {
    ...item,
    title: text(item.title),
    time: text(item.time),
    ...(typeof item.url === "string" ? { url: item.url } : {}),
    ...(typeof item.preview === "string" ? { preview: item.preview } : {}),
  };
}
function readReport(value: unknown): SessionReport {
  const item = record(value);
  if (typeof item.id !== "string" && typeof item.id !== "number")
    throw Error("Invalid local report");
  if (item.mode !== "recruiter" && item.mode !== "technical")
    throw Error("Invalid local report mode");
  return {
    ...item,
    id: item.id,
    mode: item.mode,
    title: text(item.title),
    date: text(item.date),
    elapsed: number(item.elapsed),
    transcripts: array(item.transcripts, readTranscript),
    captures: array(item.captures, readCapture),
  };
}
function preferences(value: unknown): Preferences {
  const item = record(value);
  return {
    ...item,
    output: text(item.output),
    audio: text(item.audio),
    code: text(item.code),
    source: typeof item.source === "string" ? item.source : "",
    instructions:
      typeof item.instructions === "string" ? item.instructions : "",
  };
}
function read<Value>(
  storage: Pick<Storage, "getItem">,
  key: string,
  fallback: Value,
  decode: (value: unknown) => Value,
): Value {
  try {
    const value: unknown = JSON.parse(
      storage.getItem("cadence." + key) ?? "null",
    );
    return value == null ? fallback : decode(value);
  } catch {
    return fallback;
  }
}
export function createCompatibilityState(
  storage: Pick<Storage, "getItem">,
): WorkspaceState {
  const profile = read(
    storage,
    "profile",
    {
      name: "Daniel Neri",
      role: "Desenvolvedor Full Stack",
      job: "Senior Software Engineer",
      company: "Nova Labs · Remoto",
      tags: "TypeScript, React, Node.js",
      experience:
        "Exemplo: desenvolvedor full stack com experiência em produtos SaaS. Projeto de referência: reduzir o tempo de resposta de uma API usando cache e otimização de consultas. Substitua este texto pelos seus projetos e resultados reais.",
      description:
        "Exemplo: construir produtos web, colaborar com produto e design, trabalhar com APIs, testes e arquitetura. A empresa valoriza autonomia, comunicação e decisões técnicas bem explicadas.",
    },
    readProfile,
  );
  return {
    profile,
    preferences: read(
      storage,
      "preferences",
      {
        output: "pt-BR",
        audio: "pt-BR",
        code: "TypeScript",
        concise: true,
        source: "",
        instructions: "",
      },
      preferences,
    ),
    history: read(storage, "history", [], (value) => array(value, readReport)),
    mode: "recruiter",
    busy: false,
    busyToken: 0,
    inputTab: "transcript",
    codeTab: "code",
    currentProblem: "two-sum",
    answerKind: "assist",
    customQuestion: "",
    currentReport: null,
    ended: false,
    liveReady: false,
    session: {
      active: false,
      paused: false,
      elapsed: 0,
      started: null,
      extraIndex: 0,
    },
    captures: { recruiter: [], technical: [] },
    transcripts: { recruiter: [], technical: [] },
    testsRun: false,
    testResults: [],
    toastTimeout: undefined,
    drag: null,
  };
}
