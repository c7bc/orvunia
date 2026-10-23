import { expect, test } from "bun:test";
import { errorResponse } from "../../packages/http/errors.ts";
import { CapabilityError } from "../../packages/capabilities/domain.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { ConnectionError } from "../../packages/connections/domain.ts";

test("personal error status and stable code survive mapping without raw messages or configuration", async () => {
  for (const locale of ["pt-BR", "en", "es"]) {
    const response = errorResponse(new LocalModelError("runtime_in_use", 409),
      new Request("http://localhost/api", { headers: { "accept-language": locale } }), "synthetic-request");
    expect(response.status).toBe(409);
    const result = await response.json();
    expect(result.error.code).toBe("runtime_in_use"); expect(result.error.message).not.toBe("runtime_in_use");
    expect(result.error.requestId).toBe("synthetic-request");
  }
  expect(errorResponse(new CapabilityError("original_provider_changed", 409), new Request("http://localhost"), "r").status).toBe(409);
  expect(errorResponse(new ConnectionError("connection_invalid", 422), new Request("http://localhost"), "r").status).toBe(422);
});
