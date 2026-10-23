export function createBrowserDownload(ports: {
  document: Pick<Document, "createElement">;
  url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  blob: typeof Blob;
  schedule(callback: () => void, delay: number): unknown;
}) {
  return (name: string, text: string, type: string, lifetime: number) => {
    const link = ports.document.createElement("a");
    const address = ports.url.createObjectURL(new ports.blob([text], { type }));
    link.href = address;
    link.download = name;
    try {
      link.click();
    } finally {
      ports.schedule(() => ports.url.revokeObjectURL(address), lifetime);
    }
  };
}
