import type { ExportNote, ExportPorts } from "./contracts.js";
import { exportOwnership } from "./contracts.js";

export async function downloadData(ports: ExportPorts) {
  const active = exportOwnership(ports);
  const pending: ExportNote[] = [];
  for (const session of ports.state.sessions) {
    if (ports.notes.value(session.id) === undefined) continue;
    const state = await ports.notes.flush(session.id);
    active();
    if (state?.dirty || state?.conflict || state?.error)
      pending.push({
        session: session.id,
        text: ports.notes.value(session.id),
        revision: state.revision,
        updatedAt: state.updatedAt,
        pending: true,
      });
  }
  const saved = await ports.allNotes();
  active();
  const manual = new Map(saved.notes.map((note) => [note.session, note]));
  for (const note of pending) manual.set(note.session, note);
  const { owner: _owner, ...profile } = ports.state.profile || {};
  const sessions = await ports.allSessions();
  active();
  const text = JSON.stringify(
    {
      version: 3,
      exportedAt: ports.clock().toISOString(),
      profile,
      preferences: ports.state.prefs,
      library: ports.state.library,
      sessions,
      agenda: ports.state.agenda,
      manualNotes: [...manual.values()],
    },
    null,
    2,
  );
  ports.download("cadence-dados.json", text, "application/json", 1000);
  ports.toast("Exportação preparada.");
}
