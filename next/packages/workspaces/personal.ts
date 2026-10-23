export interface PersonalRepository {
  current(): Promise<string>;
  rotate(expected: string, next: string, now: number): Promise<void>;
}
export function personalWorkspace(dependencies: {
  repository: PersonalRepository;
  identifier(): string;
  clock(): number;
  stop(workspaceId: string): Promise<void>;
  log(event: { event: string }): void;
}) {
  return {
    current: () => dependencies.repository.current(),
    async reset(workspaceId: string) {
      await dependencies.repository.rotate(
        workspaceId,
        dependencies.identifier(),
        dependencies.clock(),
      );
      await dependencies
        .stop(workspaceId)
        .catch(() =>
          dependencies.log({ event: "workspace_audio_cleanup_failed" }),
        );
    },
  };
}
