import {
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
export function createWorkspaceClipboard({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<WorkspaceController, "copy" | "downloadText"> {
  return {
    async copy(text: string) {
      try {
        await ports.window.navigator.clipboard.writeText(text);
        workspace.toast("Copiado para a área de transferência.");
      } catch {
        workspace.modal(
          "Copiar texto",
          `<p class="help">Selecione o texto abaixo e copie.</p><div class="field"><textarea aria-label="Texto para copiar" readonly>${ports.escape(text)}</textarea></div>`,
        );
      }
    },
    downloadText(name: string, text: string) {
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
      const a = ports.document.createElement("a");
      a.href = url;
      a.download = name;
      ports.document.body.appendChild(a);
      a.click();
      a.remove();
      ports.window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
