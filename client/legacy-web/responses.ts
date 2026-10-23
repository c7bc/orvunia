import type {
  Health,
  Profile,
  Preferences,
  SavedSession,
  InterviewMode,
} from "./models.js";
import { array, boolean, number, record, text } from "./validation.js";
function readMode(value: unknown): InterviewMode {
  if (value !== "recruiter" && value !== "technical")
    throw Error("Modo inválido do servidor.");
  return value;
}
export function readHealth(value: unknown): Health {
  const health = record(value),
    models = record(health.models);
  return {
    keyConfigured: boolean(health.keyConfigured),
    models: {
      response: text(models.response),
      transcription: text(models.transcription),
    },
  };
}
export function readProfile(value: unknown): Profile {
  const profile = record(value);
  return {
    ...profile,
    name: text(profile.name),
    role: text(profile.role),
    job: text(profile.job),
    company: text(profile.company),
    tags: text(profile.tags),
    experience: text(profile.experience),
    description: text(profile.description),
  };
}
export function readPreferences(value: unknown): Preferences {
  const preferences = record(value);
  return {
    ...preferences,
    output: text(preferences.output),
    audio: text(preferences.audio),
    code: text(preferences.code),
    source: text(preferences.source),
    instructions:
      typeof preferences.instructions === "string"
        ? preferences.instructions
        : "",
  };
}
export function readSession(value: unknown): SavedSession {
  const session = record(value);
  return {
    ...session,
    id: text(session.id),
    date: text(session.date),
    title: text(session.title),
    state: text(session.state),
    mode: readMode(session.mode),
    elapsed: number(session.elapsed),
    transcripts: array(session.transcripts, (value) => {
      const item = record(value);
      return {
        ...item,
        who: text(item.who),
        time: text(item.time),
        text: text(item.text),
      };
    }),
    captures: array(session.captures, (value) => {
      const item = record(value);
      return {
        ...item,
        url: text(item.url),
        title: text(item.title),
        time: text(item.time),
      };
    }),
    responses: array(session.responses, (value) => {
      const item = record(value);
      return {
        ...item,
        mode: readMode(item.mode),
        text: text(item.text),
        model: text(item.model),
        action: text(item.action),
      };
    }),
  };
}
export const readSessions = (value: unknown) => array(value, readSession);
export function readBootstrap(value: unknown) {
  const bootstrap = record(value);
  return {
    profile: bootstrap.profile ? readProfile(bootstrap.profile) : null,
    preferences: bootstrap.profile
      ? readPreferences(bootstrap.preferences)
      : null,
    sessions: readSessions(bootstrap.sessions),
  };
}
export function readAnswer(value: unknown) {
  const answer = record(value);
  return { text: text(answer.text), model: text(answer.model) };
}
export function readProfileResult(value: unknown) {
  return { profile: readProfile(record(value).profile) };
}
export function readPreferencesResult(value: unknown) {
  return { preferences: readPreferences(record(value).preferences) };
}
export function readTranscription(value: unknown) {
  return { text: text(record(value).text) };
}
