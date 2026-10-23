import type { GazeWorkerScope } from "./worker-scope";
import { localGazeNetwork } from "./worker-network";
import { loadGazeModel } from "./worker-model";
import { installGazeWorker } from "./worker-engine";
const scope = self as unknown as GazeWorkerScope;
localGazeNetwork(scope);
installGazeWorker(scope, () => loadGazeModel(scope));
