export class BackendProcessError extends Error {
  readonly recoverable: boolean;
  constructor(message: string, recoverable: boolean) {
    super(message);
    this.recoverable = recoverable;
  }
}
export class BackendShutdownError extends BackendProcessError {
  constructor() {
    super("Backend process could not be stopped", false);
  }
}
export class BackendPortInUse extends BackendProcessError {
  constructor() {
    super("Desktop backend port is already in use", false);
  }
}
