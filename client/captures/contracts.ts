export type CaptureTarget = Readonly<{
  id: string;
  mode: string;
  state: string;
}>;
export type CropRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  displayWidth: number;
};
export type CropPorts = {
  document: Document;
  current(): CaptureTarget | null;
  workspace(): string;
  escape(value: unknown): string;
  button(label: string, action: string, style?: string): string;
  modal(title: string, body: string): void;
  close(): void;
  toast(message: string): void;
  save(
    blob: Blob,
    name: string,
    target: CaptureTarget | null,
  ): Promise<unknown>;
};
export type CropState = {
  image: HTMLImageElement;
  name: string;
  target: CaptureTarget | null;
  workspace: string;
  region: CropRegion | null;
  abort: AbortController;
  unbind(): void;
};
