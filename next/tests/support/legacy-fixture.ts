import { Database } from "bun:sqlite";

export function legacyFixture(filename: string) {
  const database = new Database(filename);
  database.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE owners(id TEXT PRIMARY KEY,profile TEXT,preferences TEXT,library TEXT,active_mode TEXT);
    CREATE TABLE sessions(id TEXT PRIMARY KEY,owner TEXT,mode TEXT,title TEXT,state TEXT,elapsed INTEGER,date TEXT,question TEXT,mode_snapshot TEXT,history_generation INTEGER);
    CREATE TABLE transcripts(id TEXT PRIMARY KEY,session TEXT,text TEXT,who TEXT,time TEXT,source TEXT,segment TEXT);
    CREATE TABLE responses(id TEXT PRIMARY KEY,session TEXT,action TEXT,mode TEXT,text TEXT,model TEXT,date TEXT,question TEXT);
    CREATE TABLE captures(id TEXT PRIMARY KEY,session TEXT,title TEXT,time TEXT,mime TEXT,data BLOB);
    CREATE TABLE modes(id TEXT,owner TEXT,data TEXT);
    CREATE TABLE session_notes(session TEXT PRIMARY KEY,text TEXT,revision INTEGER,updated_at TEXT);
    CREATE TABLE answer_requests(id TEXT PRIMARY KEY,payload TEXT);
  `);
  const owner = crypto.randomUUID(),
    session = crypto.randomUUID(),
    customId = crypto.randomUUID();
  const response = crypto.randomUUID(),
    now = "2026-10-14T12:00:00.000Z";
  const mode = {
    id: customId,
    name: "Personalizado",
    base: "technical",
    instructions: "Original prompt",
    sections: [{ title: "Notas", instructions: "Preserve these sections" }],
    documents: [],
    builtin: false,
    created: now,
    updated: now,
  };
  const preferences = {
    output: "en",
    audio: "pt",
    code: "Rust",
    source: "display" as const,
    instructions: "Shared prompt",
    modeInstructions: {
      recruiter: "Recruiter prompt",
      technical: "Technical prompt",
    },
    noteTemplates: {
      recruiter: "## Contexto\nOrientação original",
      technical: "Technical notes",
    },
  };
  const library = {
    documents: [
      {
        id: crypto.randomUUID(),
        name: "Context",
        text: "Synthetic context",
        date: now,
      },
    ],
    prompts: [],
  };
  database
    .query("INSERT INTO owners VALUES(?,?,?,?,?)")
    .run(
      owner,
      null,
      JSON.stringify(preferences),
      JSON.stringify(library),
      customId,
    );
  database
    .query("INSERT INTO modes VALUES(?,?,?)")
    .run(customId, owner, JSON.stringify(mode));
  database
    .query("INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(
      session,
      owner,
      "technical",
      "Conversa preservada",
      "ended",
      123,
      now,
      "Última pergunta",
      JSON.stringify(mode),
      2,
    );
  const transcript = crypto.randomUUID();
  database
    .query("INSERT INTO transcripts VALUES(?,?,?,?,?,?,?)")
    .run(
      transcript,
      session,
      "Primeira fala",
      "Interviewer",
      "00:01",
      "audio",
      crypto.randomUUID(),
    );
  database
    .query("INSERT INTO transcripts VALUES(?,?,?,?,?,?,?)")
    .run(
      crypto.randomUUID(),
      session,
      "Segunda fala",
      "Me",
      "00:02",
      "manual",
      null,
    );
  database
    .query("INSERT INTO responses VALUES(?,?,?,?,?,?,?,?)")
    .run(
      response,
      session,
      "assist",
      "technical",
      "Resposta com acentuação",
      "synthetic",
      now,
      "Question",
    );
  const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  database
    .query("INSERT INTO captures VALUES(?,?,?,?,?,?)")
    .run(response, session, "Synthetic capture", "00:03", "image/png", image);
  database
    .query("INSERT INTO session_notes VALUES(?,?,?,?)")
    .run(session, "Notas pessoais", 7, now);
  database
    .query("INSERT INTO answer_requests VALUES(?,?)")
    .run(response, "Synthetic immutable request context");
  return {
    database,
    owner,
    session,
    customId,
    response,
    transcript,
    image,
    preferences,
    library,
  };
}
