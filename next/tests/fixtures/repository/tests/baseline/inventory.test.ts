import { describe, expect, test } from "bun:test";
import { fixture } from "../support/fixture";

describe("baseline: reservas e confirmação", () => {
  test("reserva deduz disponível e confirmação não deduz novamente", async () => {
    const { service, input } = fixture();
    const reservation = await service.reserve(input);
    expect(await service.stock("keyboard")).toBe(8);
    expect((await service.confirm(input.owner, reservation.id)).status).toBe("confirmed");
    expect((await service.confirm(input.owner, reservation.id)).status).toBe("confirmed");
    expect(await service.stock("keyboard")).toBe(8);
  });

  test("replay idempotente preserva identidade e não deduz estoque", async () => {
    const { service, input } = fixture();
    const results = await Promise.all(Array.from({ length: 20 }, () => service.reserve(input)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(await service.stock("keyboard")).toBe(8);
  });

  test("chave repetida com payload diferente falha sem alterar dados", async () => {
    const { service, input } = fixture();
    await service.reserve(input);
    await expect(service.reserve({ ...input, quantity: 3 })).rejects.toThrow("idempotency_conflict");
    expect(await service.stock("keyboard")).toBe(8);
  });

  test("recibo é isolado por dono", async () => {
    const { service, input } = fixture();
    const first = await service.reserve(input);
    const second = await service.reserve({ ...input, owner: "other" });
    expect(second.id).not.toBe(first.id);
    expect(await service.stock("keyboard")).toBe(6);
  });

  test("concorrência de pedidos distintos não vende acima do disponível", async () => {
    const { service, input } = fixture(5);
    const results = await Promise.allSettled(Array.from({ length: 30 }, (_, index) =>
      service.reserve({ ...input, requestId: `request-${index}`, quantity: 1 })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(25);
    expect(await service.stock("keyboard")).toBe(0);
  });

  test("limite de expiração é exclusivo para confirmar", async () => {
    const { service, input, advance } = fixture();
    const reservation = await service.reserve(input);
    advance(100);
    await expect(service.confirm(input.owner, reservation.id)).rejects.toThrow("reservation_expired");
    expect((await service.reservation(input.owner, reservation.id)).status).toBe("reserved");
    expect(await service.stock("keyboard")).toBe(8);
  });

  test("confirmação anterior ao prazo continua idempotente após o prazo", async () => {
    const { service, input, advance } = fixture();
    const reservation = await service.reserve(input);
    await service.confirm(input.owner, reservation.id);
    advance(101);
    expect((await service.confirm(input.owner, reservation.id)).status).toBe("confirmed");
  });

  test("outro dono não consulta nem confirma reserva", async () => {
    const { service, input } = fixture();
    const reservation = await service.reserve(input);
    await expect(service.reservation("other", reservation.id)).rejects.toThrow("reservation_not_found");
    await expect(service.confirm("other", reservation.id)).rejects.toThrow("reservation_not_found");
    expect((await service.reservation(input.owner, reservation.id)).status).toBe("reserved");
  });

  test("replay após confirmar retorna o estado atual da mesma reserva", async () => {
    const { service, input } = fixture();
    const reservation = await service.reserve(input);
    await service.confirm(input.owner, reservation.id);
    expect((await service.reserve(input)).status).toBe("confirmed");
    expect(await service.stock("keyboard")).toBe(8);
  });

  test("chave com delimitador não colide entre donos", async () => {
    const { service, input } = fixture();
    await service.reserve({ ...input, owner: "a:b", requestId: "c" });
    await service.reserve({ ...input, owner: "a", requestId: "b:c" });
    expect(await service.stock("keyboard")).toBe(6);
  });

  test("quantidades não inteiras ou não positivas são rejeitadas", () => {
    const { service, input } = fixture();
    for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => service.reserve({ ...input, quantity })).toThrow("invalid_quantity");
    }
  });

  test("prazo inválido ou identidade vazia falham antes da transação", () => {
    const { service, input } = fixture();
    expect(() => service.reserve({ ...input, owner: " " })).toThrow("invalid_identity");
    expect(() => service.reserve({ ...input, lifetimeMilliseconds: 3_600_001 })).toThrow("invalid_lifetime");
  });

  test("produto desconhecido e falta de estoque não criam recibo", async () => {
    const { service, input } = fixture(1);
    await expect(service.reserve({ ...input, product: "unknown" })).rejects.toThrow("product_not_found");
    await expect(service.reserve(input)).rejects.toThrow("insufficient_stock");
    expect((await service.reserve({ ...input, quantity: 1 })).status).toBe("reserved");
  });
});
