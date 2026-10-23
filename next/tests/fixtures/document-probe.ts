export {};

if (process.argv[2] === ".wait") {
  await Bun.write(await Bun.stdin.text(), String(process.pid));
  await Bun.sleep(60_000);
} else if (process.argv[2] === ".overflow") {
  await Bun.write(Bun.stdout, "x".repeat(240_001));
  await Bun.sleep(60_000);
} else if (process.argv[2] === ".environment") {
  console.log(
    JSON.stringify({ text: process.env.CADENCE_DOCUMENT_PROBE ?? "absent" }),
  );
} else if (process.argv[2] === ".bad") {
  console.log(JSON.stringify({ text: "synthetic", extra: "forbidden" }));
} else {
  console.log(JSON.stringify({ text: "synthetic" }));
}
