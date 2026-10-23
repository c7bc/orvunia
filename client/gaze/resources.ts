export function releaseStream(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) {
    try {
      track.stop();
    } catch {}
  }
}
