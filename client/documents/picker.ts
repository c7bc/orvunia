export const referenceExtensions =
  ".pdf,.docx,.txt,.md,.json,.csv,.ts,.js,.py,.java,.cpp,.go,.rs,.sql,.kt,.cs,.rb";
export function chooseReferenceFiles(document: Document, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<File[]>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = referenceExtensions;
    input.multiple = true;
    input.hidden = true;
    function cleanup() {
      signal.removeEventListener("abort", aborted);
      input.removeEventListener("change", changed);
      input.removeEventListener("cancel", cancelled);
      input.remove();
    }
    function changed() {
      const files = [...(input.files ?? [])];
      cleanup();
      resolve(files);
    }
    function cancelled() {
      cleanup();
      resolve([]);
    }
    function aborted() {
      cleanup();
      reject(new DOMException("Interrupted", "AbortError"));
    }
    input.addEventListener("change", changed, { once: true });
    input.addEventListener("cancel", cancelled, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    document.body.append(input);
    try {
      if (signal.aborted) aborted();
      else input.click();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
