import { createHash } from "node:crypto";
import { answerSchema } from "../../packages/contracts/answers.ts";
import type { legacyFixture } from "./legacy-fixture.ts";
export function legacyRequests(fixture: ReturnType<typeof legacyFixture>) {
  const { database, owner, session, response } = fixture,
    now = Date.now(),
    imageId = crypto.randomUUID();
  database.exec(`DROP TABLE answer_requests;
    ALTER TABLE responses ADD COLUMN request_hash TEXT NOT NULL DEFAULT '';
    CREATE TABLE answer_requests(id TEXT PRIMARY KEY,owner TEXT,session TEXT,request_hash TEXT,payload TEXT,capture_ids TEXT,created INTEGER,expires INTEGER,state TEXT);
    CREATE TABLE answer_request_images(request_id TEXT,ordinal INTEGER,capture_id TEXT,mime TEXT,data BLOB);
    CREATE TABLE tell_me_more(owner TEXT,session TEXT,source TEXT,request_id TEXT,status TEXT,expires INTEGER,text TEXT,model TEXT,context_source TEXT,cancelled INTEGER);`);
  const input = answerSchema.parse({
      requestId: response,
      mode: "technical",
      action: "assist",
      question: "ORIGINAL QUESTION",
      captureIds: [imageId],
    }),
    hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    requestId = crypto.randomUUID(),
    unknownId = crypto.randomUUID();
  const context = (requestInput: typeof input) => ({
    version: 1,
    context: {
      input: requestInput,
      profile: null,
      preferences: {
        ...fixture.preferences,
        instructions: "ORIGINAL FROZEN PREFERENCES",
      },
      documents: "ORIGINAL FROZEN DOCUMENT",
      session: {
        id: session,
        owner,
        state: "active",
        transcripts: [
          {
            id: crypto.randomUUID(),
            text: "ORIGINAL FROZEN TRANSCRIPT",
            who: "Eu",
            time: "00:00",
            source: "audio",
          },
        ],
        responses: [],
      },
      providerParameters: {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        model: "synthetic-historical-model",
        vision: true,
        maxTokens: 3000,
      },
    },
  });
  const detailsInput = answerSchema.parse({
      ...input,
      requestId,
      action: "explain",
    }),
    unknownInput = answerSchema.parse({
      ...input,
      requestId: unknownId,
      captureIds: [],
    });
  for (const [id, payload, fingerprint, state] of [
    [response, context(input), hash(input), "completed"],
    [
      requestId,
      context(detailsInput),
      hash({ source: response, requestId, kind: "tell-me-more" }),
      "completed",
    ],
    [unknownId, context(unknownInput), hash(unknownInput), "processing"],
  ] as const)
    database
      .query("INSERT INTO answer_requests VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        owner,
        session,
        fingerprint,
        JSON.stringify(payload),
        JSON.stringify(id === unknownId ? [] : [imageId]),
        now,
        now + 3600000,
        state,
      );
  database
    .query("UPDATE responses SET request_hash=? WHERE id=?")
    .run(hash(input), response);
  for (const id of [response, requestId])
    database
      .query("INSERT INTO answer_request_images VALUES(?,?,?,?,?)")
      .run(id, 0, imageId, "image/png", fixture.image);
  database
    .query("INSERT INTO tell_me_more VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(
      owner,
      session,
      response,
      requestId,
      "ready",
      now + 3600000,
      "PRIVATE PREPARED DETAILS",
      "synthetic-historical-model",
      "original-snapshot",
      0,
    );
  return { input, unknownInput, requestId, imageId };
}
