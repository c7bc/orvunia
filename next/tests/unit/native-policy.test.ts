import { expect, test } from "bun:test";
import {
  configuredCloudOrigin,
  matchesOrigin,
  isDesktopDocument,
} from "../../packages/desktop/origin.ts";
import { permittedExternalURL } from "../../packages/desktop/external.ts";

test("native cloud configuration and document authorization require an exact origin and trusted desktop path", () => {
  expect(configuredCloudOrigin(undefined)).toBeNull();
  expect(configuredCloudOrigin("https://cloud.example.test/")).toBe(
    "https://cloud.example.test",
  );
  for (const value of [
    "http://cloud.example.test",
    "https://user:pass@cloud.example.test",
    "https://cloud.example.test/path",
    "https://cloud.example.test?token=private",
    "https://cloud.example.test#fragment",
    " https://cloud.example.test",
    {},
  ])
    expect(() => configuredCloudOrigin(value)).toThrow();
  expect(
    matchesOrigin(
      "https://cloud.example.test/desktop.html?view=panel",
      "https://cloud.example.test",
    ),
  ).toBe(true);
  expect(
    isDesktopDocument(
      "https://cloud.example.test/desktop.html?view=panel",
      "https://cloud.example.test",
    ),
  ).toBe(true);
  for (const value of [
    "https://cloud.example.test.evil.test/desktop.html",
    "https://user@cloud.example.test/desktop.html",
    "https://cloud.example.test/elsewhere",
    "file:///desktop.html",
    "invalid",
  ])
    expect(isDesktopDocument(value, "https://cloud.example.test")).toBe(false);
});

test("native external navigation permits scoped meeting and payment URLs without accepting lookalike or arbitrary hosts", () => {
  const service = "http://127.0.0.1:9915",
    cloud = "https://cloud.example.test";
  for (const url of [
    cloud + "/account",
    "https://meet.google.com/synthetic",
    "https://tenant.zoom.us/j/123",
    "https://teams.microsoft.com/meeting",
    "https://checkout.stripe.com/c/pay/cs_synthetic",
    "https://billing.stripe.com/p/session/synthetic_123",
  ])
    expect(permittedExternalURL(url, service, cloud)).toBe(url);
  for (const url of [
    "https://cloud.example.test.evil.test",
    "https://checkout.stripe.com.evil.test/c/pay/cs_synthetic",
    "https://evil-zoom.us/j/123",
    "https://meet.google.com:8443/synthetic",
    "https://billing.stripe.com/arbitrary",
    "https://checkout.stripe.com/arbitrary",
    "https://user@meet.google.com/synthetic",
    "javascript:alert(1)",
    "file:///private",
    "https://evil.example.test",
    "https://meet.google.com/\nsynthetic",
  ])
    expect(() => permittedExternalURL(url, service, cloud)).toThrow();
});

test("native Google Calendar navigation requires the exact return origin, read-only scope and PKCE", () => {
  const service = "http://127.0.0.1:9915",
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    redirect_uri: service + "/api/calendar/callback",
    scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    response_type: "code",
    state: "synthetic-state-over-twenty",
    client_id: "synthetic-client",
    code_challenge_method: "S256",
    code_challenge: "s".repeat(43),
  }).toString();
  expect(permittedExternalURL(url.href, service, null)).toBe(url.href);
  for (const [key, value] of [
    ["redirect_uri", "https://attacker.example.test/api/calendar/callback"],
    ["redirect_uri", service + "/api/calendar/callback?token=private"],
    ["scope", "https://www.googleapis.com/auth/calendar"],
    ["state", "short"],
    ["code_challenge_method", "plain"],
    ["code_challenge", "short"],
    ["response_type", "token"],
    ["client_id", ""],
  ]) {
    const changed = new URL(url);
    changed.searchParams.set(key!, value!);
    expect(() => permittedExternalURL(changed.href, service, null)).toThrow();
  }
});
