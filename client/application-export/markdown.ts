import type { ExportPorts } from "./contracts.js";
import { exportOwnership } from "./contracts.js";

export async function exportSession(ports: ExportPorts, sessionId: string) {
  const active = exportOwnership(ports);
  const flushed = await ports.notes.flush(sessionId);
  active();
  const localNotes = ports.notes.value(sessionId);
  let pending = Boolean(flushed?.dirty || flushed?.conflict || flushed?.error);
  let manual: { text: string; revision: number };
  try {
    manual = await ports.savedNotes(sessionId);
  } catch (error) {
    active();
    if (localNotes === undefined) throw error;
    pending = true;
    manual = { text: localNotes, revision: flushed?.revision || 0 };
  }
  active();
  if (localNotes !== undefined && pending)
    manual = { ...manual, text: localNotes };
  const session = await ports.session(sessionId);
  active();
  const t = ports.translate;
  const text = `# ${session.title}\n\n${ports.date(session.date)} · ${ports.modeName(session.mode)} · ${ports.time(session.elapsed)}${manual.revision > 0 || pending ? `\n\n## ${t("Notas manuais")}${pending ? ` (${t("pendentes de salvar")})` : ""}\n\n${manual.text}` : ""}\n\n## Respostas\n\n${session.responses.map((response) => `### ${ports.actionTitle(response.action, response.mode)}\n\n${response.text}`).join("\n\n---\n\n")}\n\n## Transcrição\n\n${session.transcripts.map((transcript) => `**[${transcript.time}] ${transcript.who}:** ${transcript.text}`).join("\n\n")}`;
  if (ports.native) {
    const result = await ports.native.export({ name: session.title, text });
    active();
    if (result.saved) ports.toast("Sessão exportada.");
  } else {
    ports.download(
      session.title.replace(/[^\p{L}\p{N} _-]/gu, "") + ".md",
      text,
      "text/markdown;charset=utf-8",
      2000,
    );
  }
}
