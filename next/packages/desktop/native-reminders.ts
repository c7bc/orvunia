export function createNativeReminders<Timer>(ports: {
  enabled(): boolean;
  clock(): number;
  locale(): string;
  schedule(callback: () => void, milliseconds: number): Timer;
  cancel(timer: Timer): void;
  show(title: string, body: string): void;
}) {
  const timers = new Set<Timer>();
  let generation = 0;
  function stop() {
    generation++;
    for (const timer of timers) ports.cancel(timer);
    timers.clear();
  }
  return {
    replace(value: unknown) {
      if (!ports.enabled()) return { scheduled: 0 };
      if (!Array.isArray(value) || value.length > 200)
        throw Error("Agenda inválida.");
      const now = ports.clock();
      const selected: { delay: number; title: string }[] = [];
      for (const item of value) {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw Error("Agenda inválida.");
        const fields = item as Record<string, unknown>;
        if (typeof fields.title !== "string" || typeof fields.date !== "string")
          throw Error("Agenda inválida.");
        const delay = new Date(fields.date).getTime() - now - 5 * 60000;
        if (delay >= 0 && delay < 24 * 86400000)
          selected.push({ delay, title: fields.title.slice(0, 180) });
      }
      stop();
      const ticket = generation;
      try {
        for (const item of selected) {
          const timer = ports.schedule(() => {
            timers.delete(timer);
            if (ticket !== generation || !ports.enabled()) return;
            ports.show(
              ports.locale().startsWith("es")
                ? "Tu conversación comienza en 5 minutos"
                : ports.locale() === "en"
                  ? "Your conversation starts in 5 minutes"
                  : "Sua conversa começa em 5 minutos",
              item.title,
            );
          }, item.delay);
          timers.add(timer);
        }
      } catch (error) {
        stop();
        throw error;
      }
      return { scheduled: timers.size };
    },
    stop,
    pending: () => timers.size,
  };
}
