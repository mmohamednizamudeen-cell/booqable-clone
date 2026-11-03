import { beforeEach, describe, expect, it } from "vitest";
import * as store from "./store";

const day = 86_400_000;
const future = (days: number, hour = 9) => {
  const d = new Date();
  d.setUTCHours(hour + 5, 0, 0, 0); // ~local morning in New York
  return d.getTime() + days * day;
};

async function product(name: string) {
  return (await store.listProducts({ q: name }))[0]!;
}

beforeEach(async () => store.resetForTests());

describe("back-office booking", () => {
  it("new -> reserved -> picked up -> returned", async () => {
    const tripod = await product("Video tripod");
    let o = await store.newOrder();
    await store.setOrderPeriod(o.id, future(10), future(11));
    o = await store.addOrderItem(o.id, tripod.id, 1);
    o = await store.transition(o.id, "reserved");
    expect(o.status).toBe("reserved");
    expect(o.number).not.toBeNull();
    const units = await store.freeUnitsFor(o.id, o.lines[0]!.id);
    o = await store.pickup(o.id, [{ lineId: o.lines[0]!.id, unitIds: [units[0]!.id] }]);
    expect(o.status).toBe("started");
    o = await store.returnItems(o.id, [{ lineId: o.lines[0]!.id, unitIds: [units[0]!.id] }], { keptCents: 2500, reason: "Bent leg clamp" });
    expect(o.status).toBe("stopped");
    expect(o.depositKeptCents).toBe(2500);
  });

  it("will not hand out a unit that is still out on another booking", async () => {
    // seed: the only PA speaker is out with a customer and due back today
    const speaker = await product("PA speaker");
    let o = await store.newOrder();
    await store.setOrderPeriod(o.id, future(10), future(11));
    o = await store.addOrderItem(o.id, speaker.id, 1);
    o = await store.transition(o.id, "reserved"); // fine: it is due back long before
    const units = await store.freeUnitsFor(o.id, o.lines[0]!.id);
    await expect(store.pickup(o.id, [{ lineId: o.lines[0]!.id, unitIds: [units[0]!.id] }])).rejects.toThrow(/not come back/);
  });

  it("cannot reserve without dates or items", async () => {
    const o = await store.newOrder();
    await expect(store.transition(o.id, "reserved")).rejects.toThrow(/rental period/);
  });

  it("blocks a second booking of the only speaker for overlapping dates", async () => {
    const speaker = await product("PA speaker");
    const a = await store.newOrder();
    await store.setOrderPeriod(a.id, future(10), future(12));
    await store.addOrderItem(a.id, speaker.id, 1);
    await store.transition(a.id, "reserved");
    const b = await store.newOrder();
    await store.setOrderPeriod(b.id, future(11), future(13));
    await store.addOrderItem(b.id, speaker.id, 1);
    await expect(store.transition(b.id, "reserved")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("warns inside the shortage limit and blocks over it", async () => {
    const chair = await product("Folding chair"); // 80 in stock, limit 10
    const o = await store.newOrder();
    await store.setOrderPeriod(o.id, future(20), future(21));
    await store.addOrderItem(o.id, chair.id, 85);
    await expect(store.transition(o.id, "reserved")).rejects.toMatchObject({ code: "shortage_warning" });
    expect((await store.transition(o.id, "reserved", { confirmShortage: true })).status).toBe("reserved");
    const o2 = await store.newOrder();
    await store.setOrderPeriod(o2.id, future(20), future(21));
    await store.addOrderItem(o2.id, chair.id, 10);
    await expect(store.transition(o2.id, "reserved")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("refuses to move a reserved booking onto dates without stock", async () => {
    const speaker = await product("PA speaker");
    const a = await store.newOrder();
    await store.setOrderPeriod(a.id, future(30), future(31));
    await store.addOrderItem(a.id, speaker.id, 1);
    await store.transition(a.id, "reserved");
    const b = await store.newOrder();
    await store.setOrderPeriod(b.id, future(40), future(41));
    await store.addOrderItem(b.id, speaker.id, 1);
    await store.transition(b.id, "reserved");
    await expect(store.setOrderPeriod(b.id, future(30), future(31))).rejects.toMatchObject({ code: "unavailable" });
    expect((await store.getOrder(b.id))!.startsAt).toBe(future(40)); // unchanged
  });

  it("respects the camera's 1 hour buffer after a return", async () => {
    const camera = await product("camera kit"); // 2 units, 1h after-buffer
    const book = async (s: number, e: number) => {
      const o = await store.newOrder();
      await store.setOrderPeriod(o.id, s, e);
      await store.addOrderItem(o.id, camera.id, 2);
      try {
        return await store.transition(o.id, "reserved");
      } catch (err) {
        await store.transition(o.id, "canceled"); // drop the refused scratch booking
        throw err;
      }
    };
    await book(future(50, 9), future(51, 9));
    await expect(book(future(51, 9) + 30 * 60_000, future(52, 9))).rejects.toMatchObject({ code: "unavailable" });
    expect((await book(future(51, 10), future(52, 9))).status).toBe("reserved");
  });

  it("partial pickup keeps the booking started with items left", async () => {
    const chair = await product("Folding chair");
    let o = await store.newOrder();
    await store.setOrderPeriod(o.id, future(60), future(61));
    o = await store.addOrderItem(o.id, chair.id, 20);
    await store.transition(o.id, "reserved");
    o = await store.pickup(o.id, [{ lineId: o.lines[0]!.id, quantity: 12 }]);
    expect(o.fulfillment).toBe("partially_started");
    await expect(store.pickup(o.id, [{ lineId: o.lines[0]!.id, quantity: 9 }])).rejects.toThrow(/0 to 8/);
  });

  it("cancel releases stock", async () => {
    const speaker = await product("PA speaker");
    const a = await store.newOrder();
    await store.setOrderPeriod(a.id, future(70), future(71));
    await store.addOrderItem(a.id, speaker.id, 1);
    await store.transition(a.id, "reserved");
    await store.transition(a.id, "canceled");
    const r = await store.availability(speaker.id, future(70), future(71));
    expect(r.free).toBe(1);
  });
});

describe("storefront checkout", () => {
  it("two customers racing for the last speaker: one booking, one refusal", async () => {
    const speaker = await product("PA speaker");
    const carts = await Promise.all([store.createCart(), store.createCart()]);
    for (const c of carts) {
      await store.setCartPeriod(c.id, future(80), future(81));
      await store.addCartLine(c.id, speaker.id, 1);
    }
    const results = await Promise.allSettled([
      store.checkout(carts[0]!.id, { name: "First", email: "first@example.com" }),
      store.checkout(carts[1]!.id, { name: "Second", email: "second@example.com" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason.code).toBe("unavailable");
    const booked = await store.getOrderByToken((results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ orderToken: string }>).value.orderToken);
    expect(booked!.status).toBe("reserved");
  });

  it("validates contact details", async () => {
    const c = await store.createCart();
    await expect(store.checkout(c.id, { name: "A", email: "nope" })).rejects.toThrow(/email/);
  });
});
