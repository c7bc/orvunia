import { requireCommandSession } from "./model.js";
import { commandScope } from "./scope.js";
import {
  commandSession,
  commandTranscript,
  commandPrompt,
} from "./boundary.js";

import {
  commandError,
  datasetValue,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopSubmit(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("submit", async (e) => {
    const target = e.target as HTMLFormElement | null;
    if (!target) return;
    if (target.id === "coding-context-form") {
      e.preventDefault();
      try {
        const enabled =
          target.querySelector<HTMLInputElement>('[name="prefetchTellMore"]')
            ?.checked === true;
        if (!enabled && ports.tellMore.stats().active)
          await ports.tellMore.cancelActive();
        ports.coding.save(datasetValue(target.dataset.session), {
          ...ports.values(target),
          prefetchTellMore: enabled,
        });
        ports.closeModal();
        ports.render();
        ports.toast("Enunciado e código preparados para a próxima pergunta.");
      } catch (error) {
        ports.toast(commandError(error));
      }
      return;
    }
    if (target.id === "followup-draft") {
      e.preventDefault();
      try {
        if (await ports.saveFollowup(target)) ports.toast("Rascunho salvo.");
      } catch (error) {
        ports.toast(commandError(error));
      }
      return;
    }
    e.preventDefault();
    const form = target;
    if (!["workspace-delete-form", "rename-session-form", "start-form", "profile-form", "transcript-form", "prompt-form", "schedule-form"].includes(form.id)) return;
    const data = ports.values(form);
    try {
      if (form.id === "workspace-delete-form") {
        const workspace = ports.workspace();
        browser.controller?.abort();
        ports.gaze.stop();
        await ports.audio.stop();
        if (!events.active() || ports.workspace() !== workspace) return;
        await ports.request("/workspace", "DELETE", {
          confirmation: data.confirmation,
        });
        if (!events.active() || ports.workspace() !== workspace) return;
        ports.window.localStorage.removeItem(ports.workspace());
        for (const key of Object.keys(ports.window.localStorage))
          if (key.startsWith("cadence-followup:" + ports.workspace() + ":"))
            ports.window.localStorage.removeItem(key);
        ports.window.localStorage.removeItem("cadence-agenda");
        await ports.native?.end();
        ports.window.location.reload();
        return;
      }
      if (form.id === "rename-session-form") {
        const scope = commandScope(context);
        const renamed = commandSession(
          await ports.request(
            `/sessions/${requireCommandSession(browser).id}`,
            "PATCH",
            {
              title: data.title,
            },
          ),
        );
        if (!events.active() || !scope.current()) return;
        browser.current = renamed;
        await ports.sync();
        if (!events.active() || !scope.current()) return;
        ports.closeModal();
        ports.render();
      }
      if (form.id === "start-form")
        await ports.begin(
          datasetValue(form.dataset.mode),
          datasetValue(data.title),
        );
      if (form.id === "profile-form") {
        await ports.request("/profile", "PUT", data);
        await ports.sync();
        ports.closeModal();
        ports.render();
        ports.broadcast({ type: "changed" });
        ports.toast("Contexto salvo.");
      }
      if (form.id === "transcript-form") {
        const scope = commandScope(context);
        const t = commandTranscript(
          await ports.request(
            `/sessions/${requireCommandSession(browser).id}/transcripts`,
            "POST",
            {
              ...data,
              time: ports.time(ports.duration()),
              source: "manual",
              segmentId: ports.identifier(),
            },
          ),
        );
        if (!events.active() || !scope.current()) return;
        const transcripts = requireCommandSession(browser).transcripts;
        if (!transcripts.some((item) => item.id === t.id)) transcripts.push(t);
        ports.broadcast({ type: "changed" });
        ports.render();
      }
      if (form.id === "prompt-form") {
        const prompt = commandPrompt(
          data,
          form.dataset.id || ports.identifier(),
        );
        browser.library.prompts = browser.library.prompts.filter(
          (p) => p.id !== prompt.id,
        );
        browser.library.prompts.push(prompt);
        await ports.saveLibrary();
        ports.closeModal();
      }
      if (form.id === "schedule-form") {
        const dateValue = new Date(data.date ?? "");
        if (
          !Number.isFinite(dateValue.getTime()) ||
          dateValue.getTime() < ports.clock()
        )
          throw Error("Escolha uma data futura.");
        if (!browser.modes.some((mode) => mode.id === data.mode))
          throw Error(
            "Este modo não está mais disponível. Escolha outro modo.",
          );
        const title = String(data.title || "").trim();
        if (!title || title.length > 200)
          throw Error("Preencha um título de até 200 caracteres.");
        browser.agenda.push({
          title,
          mode: datasetValue(data.mode),
          id: ports.identifier(),
          date: dateValue.toISOString(),
        });
        ports.saveAgenda();
        ports.closeModal();
        ports.render();
      }
    } catch (error) {
      ports.toast(commandError(error));
    }
  });
}
