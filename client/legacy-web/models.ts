export type InterviewMode = "recruiter" | "technical";
export type ModeValues<Value> = Record<InterviewMode, Value>;
export type Profile = Record<
  "name" | "role" | "job" | "company" | "tags" | "experience" | "description",
  string
>;
export interface Preferences {
  concise?: boolean;
  output: string;
  audio: string;
  code: string;
  source: string;
  instructions: string;
}
export interface Transcript {
  who: string;
  time: string;
  text: string;
}
export interface Capture {
  url?: string;
  title: string;
  time: string;
  preview?: string;
}
export interface Answer {
  text: string;
  model: string;
  action: string;
  pending: boolean;
  error?: string;
}
export interface SessionResponse {
  mode: InterviewMode;
  text: string;
  model: string;
  action: string;
}
export interface SessionReport {
  id: string | number;
  date: string;
  title: string;
  state?: string;
  mode: InterviewMode;
  elapsed: number;
  transcripts: Transcript[];
  captures: Capture[];
  responses?: SessionResponse[];
  question?: string;
}
export interface SavedSession extends SessionReport {
  id: string;
  state: string;
  responses: SessionResponse[];
}
export interface Health {
  keyConfigured: boolean;
  models: { response: string; transcription: string };
}
export interface Problem {
  title: string;
  desc: string;
  input: string;
}
export interface BrowserState {
  profile: Profile;
  preferences: Preferences;
  history: SessionReport[];
  transcripts: ModeValues<Transcript[]>;
  captures: ModeValues<Capture[]>;
  mode: InterviewMode;
  liveReady: boolean;
  ended: boolean;
  busy: boolean;
  busyToken: number;
  answerKind: string;
  customQuestion: string;
  currentProblem: string;
  inputTab: string;
  session: {
    active: boolean;
    paused: boolean;
    elapsed: number;
    started: string | null;
  };
}
