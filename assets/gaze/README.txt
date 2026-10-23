LOCAL GAZE ESTIMATION — EXPERIMENTAL

Integration:
  import {createGazeController} from '/gaze-ui.js';
  const gaze=createGazeController({native:window.cadence,onState:renderSettings,toast});
  container.innerHTML=gaze.renderSettings();
  const detach=gaze.bind(container);

The controller exposes start(), stop(reason?), calibrate(), status() and dispose().
Only a human click on "Ativar e calibrar" starts the camera. Importing, rendering
or binding the module does not start capture. It never requests microphone audio.
Do not call start automatically. native.gaze({x,y}) receives a normalized estimate
relative to the calibrated monitor (0..1); no native method means browser preview.
After successful calibration, the controller awaits native.gaze({enabled:true})
before sending points. stop/cancel/recalibration release with {enabled:false}.
status().nativeEnabled becomes true only after the lease is acknowledged, and
is cleared before release to avoid recursive native state-change handling.
Native movement is limited to eight updates per second. The host should clamp
window bounds and preserve explicit user control. A hidden renderer needs
backgroundThrottling:false, or a dedicated renderer, to continue processing.

Assets/CSP:
  Serve .js/.mjs as text/javascript, .wasm as application/wasm, .task as octet-stream.
  script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'.
  No CDN, remote model, unsafe-eval, SharedArrayBuffer or cross-origin isolation
  is required by the tested single-thread CPU worker. Keep both SIMD and non-SIMD
  WASM pairs. Every upstream byte is pinned in PROVENANCE.json.

Behavior:
  640x480 webcam preference, 15 fps preference, CPU inference in a worker.
  Nine targets; each collects at least 18 valid samples after a settling delay.
  Features use iris centers relative to eye corners, eye openness and head pose.
  A temporary ridge regression maps features to screen coordinates; held-out
  calibration samples reject fits with excessive error. Smoothing, dead zone,
  velocity limits and screen bounds reduce jitter. This is an estimate rather
  than a validated eye tracker. It may need frequent recalibration.
  Glasses, glare, poor light, camera quality and head movement affect results.
  Moving monitors, changing the camera or repositioning requires recalibration.

Shutdown:
  Cancel/Esc, explicit stop, errors, page close or 15 seconds without usable eyes
  stop all tracks, terminate the worker, discard calibration and leave fullscreen.
  Model startup, camera permission, inference and per-point calibration have
  time limits. A camera permission granted after cancellation is stopped at once.
  The feature never writes frames, landmarks or calibration to disk or a server.

Validation performed:
  Four deterministic tests cover eye geometry/blink rejection, nine-point
  regression/generalization, invalid calibration, smoothing and bounds.
  Two mock-only lifecycle tests verify camera/worker cleanup, native lease
  ordering, and rejection of an enable acknowledgement arriving after cancel.
  A hidden Electron probe initialized the bundled worker/model under the CSP
  above and processed a synthetic blank frame. Camera calls: zero. No webcam or
  microphone was opened. Real webcam accuracy, calibration usability and moving
  the native assistant with a person's gaze remain unvalidated.

Sources:
  https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
  https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
  https://developers.google.com/edge/mediapipe/solutions/tasks
  https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py
