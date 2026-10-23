declare module "@cadence/gaze-vision" {
  type VisionFiles = {
    wasmLoaderPath: string;
    wasmBinaryPath: string;
    assetLoaderPath?: string;
    assetBinaryPath?: string;
  };
  type VisionModel = {
    detectForVideo(
      frame: ImageBitmap,
      timestamp: number,
    ): { faceLandmarks: { x: number; y: number }[][] };
    close(): void;
  };
  export const FilesetResolver: {
    forVisionTasks(path: string): Promise<VisionFiles>;
  };
  export const FaceLandmarker: {
    createFromOptions(
      files: VisionFiles,
      options: {
        baseOptions: { modelAssetBuffer: Uint8Array; delegate: "CPU" | "GPU" };
        runningMode: "VIDEO";
        numFaces: number;
        minFaceDetectionConfidence: number;
        minFacePresenceConfidence: number;
        minTrackingConfidence: number;
        outputFaceBlendshapes: boolean;
        outputFacialTransformationMatrixes: boolean;
      },
    ): Promise<VisionModel>;
  };
}
