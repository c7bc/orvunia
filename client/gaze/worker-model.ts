import type { GazeWorkerScope } from "./worker-scope";
export async function loadGazeModel(scope: GazeWorkerScope) {
  const { FaceLandmarker, FilesetResolver } =
    await import("@cadence/gaze-vision");
  const response = await scope.fetch(
    new URL("./face_landmarker.task", scope.location.href),
    { credentials: "same-origin", signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw Error("Não foi possível carregar o modelo local.");
  const buffer = await response.arrayBuffer(),
    hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  if (
    hash !== "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
  )
    throw Error("A integridade do modelo local não confere.");
  const files = await FilesetResolver.forVisionTasks(
    new URL("./wasm", scope.location.href).href,
  );
  return FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetBuffer: new Uint8Array(buffer), delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.7,
    minFacePresenceConfidence: 0.7,
    minTrackingConfidence: 0.7,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}
