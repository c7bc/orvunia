import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { benchmarkFixtures } from "../../packages/local-models/benchmarks/fixtures.ts";
import { benchmarkQuality, wordErrorRate } from "../../packages/local-models/benchmarks/quality.ts";

test("pinned synthetic WAV/PNG fixtures verify bytes and references without leaking transcription reference into prompts", () => {
  const fixtures = benchmarkFixtures(["text", "vision", "transcription"]);
  expect(fixtures).toHaveLength(5);
  for (const fixture of fixtures) {
    expect(createHash("sha256").update(fixture.bytes).digest("hex")).toBe(fixture.sha256);
    expect(fixture.reference.length).toBeGreaterThan(0);
    if (fixture.capability === "transcription") {
      expect(Buffer.from(fixture.bytes).toString("ascii", 0, 4)).toBe("RIFF");
      expect(Buffer.from(fixture.bytes).toString("ascii", 8, 12)).toBe("WAVE");
      expect(fixture.prompt).toBe("");
    }
    if (fixture.capability === "vision") {
      expect(Buffer.from(fixture.bytes).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(fixture.id).toBe("code-map-array"); expect(fixture.reference).toBe("[4,8,12]");
      expect(fixture.prompt).not.toContain(fixture.reference);
    }
  }
});

test("text/technical vision require exact arrays and STT quality uses fixed WER including empty and extra words", () => {
  expect(benchmarkQuality("text", "[3,1,2]", " [3, 1, 2]\n").passed).toBe(true);
  for (const output of ["[1,2,3]", "{\"answer\":[3,1,2]}", "```json\n[3,1,2]\n```", "[3,1]", ""])
    expect(benchmarkQuality("text", "[3,1,2]", output).passed).toBe(false);
  expect(benchmarkQuality("vision", "[4,8,12]", "[4,8,12]").passed).toBe(true);
  expect(benchmarkQuality("transcription", "O teste começa agora.", "O TESTE COMEÇA AGORA")).toMatchObject({ passed: true, value: 0, maximum: 0.25 });
  expect(benchmarkQuality("transcription", "La prueba empieza ahora", "")).toMatchObject({ passed: false, value: 1 });
  expect(wordErrorRate("one two", "one two three four five")).toBe(1.5);
});

test("low WER cannot approve dropped negation or technical vocabulary in PT/EN/ES", () => {
  for (const [reference, output] of [
    ["O sistema não deve alterar os dados do serviço atual", "O sistema deve alterar os dados do serviço atual"],
    ["The system must not change the data in this service", "The system must change the data in this service"],
    ["El sistema no debe cambiar los datos de este servicio", "El sistema debe cambiar los datos de este servicio"],
    ["Use Python e SQL para processar todos os dados do serviço", "Use SQLite e SQL para processar todos os dados do serviço"],
    ["Não repita os pedidos quando o serviço estiver indisponível", "Não repita os pedidos quando o serviço estiver disponível"],
    ["Do not retry requests when the service is unavailable", "Do not retry requests when the service is available"],
    ["No repitas las solicitudes cuando el servicio esté indisponible", "No repitas las solicitudes cuando el servicio esté disponible"],
    ["O sistema deve alterar os dados do serviço atual", "O sistema não deve alterar os dados do serviço atual"],
    ["The system must change the data in this service", "The system must not change the data in this service"],
    ["El sistema debe cambiar los datos de este servicio", "El sistema no debe cambiar los datos de este servicio"],
  ]) {
    const quality = benchmarkQuality("transcription", reference!, output!);
    expect(quality.value).toBeLessThanOrEqual(0.25);
    expect(quality).toMatchObject({ criticalTermsPreserved: false, passed: false });
  }
  expect(benchmarkQuality("text", "[1]", "[1]").criticalTermsPreserved).toBeNull();
});
