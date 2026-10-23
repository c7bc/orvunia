import type { CommandAgenda } from "../commands/model.js";
import { parseCalendar } from "./parse.js";
export { parseCalendar } from "./parse.js";
export function createCalendarImport(ports: {
  state: { agenda: CommandAgenda[]; selectedMode: string };
  workspace(): string;
  clock(): number;
  identifier(): string;
  pick(
    accept: string,
    callback: (files: File[]) => Promise<void>,
    multiple: boolean,
  ): void;
  save(): void;
  render(): void;
  toast(message: string): void;
}) {
  return () => {
    const workspace = ports.workspace();
    ports.pick(
      ".ics",
      async (files) => {
        for (const file of files) {
          if (ports.workspace() !== workspace) return;
          if (file.size > 1024 * 1024)
            throw Error("Use uma agenda de até 1 MB.");
          const text = await file.text();
          if (ports.workspace() !== workspace) return;
          const entries = parseCalendar(text, {
            existing: ports.state.agenda,
            mode: ports.state.selectedMode,
            clock: ports.clock,
            identifier: ports.identifier,
          });
          ports.state.agenda.push(...entries);
          ports.save();
          ports.render();
          const count = entries.length;
          ports.toast(
            `${count} lembrete${count === 1 ? "" : "s"} importado${count === 1 ? "" : "s"}. Eventos com fuso local usam o horário deste computador.`,
          );
        }
      },
      false,
    );
  };
}
