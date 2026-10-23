export async function requireRepositoryReview(ports: {
  approved(): boolean;
  prepared(): Promise<unknown>;
  review(): Promise<unknown>;
  failed(): void;
}): Promise<boolean> {
  if (ports.approved()) return false;
  try {
    if (!await ports.prepared()) return false;
    await ports.review();
  } catch { ports.failed(); }
  return !ports.approved();
}
