import { Subject } from "rxjs";
import { ChargingRuntimeService } from "./charging-runtime.service";

describe("backend charging runtime", () => {
  let runtime: ChargingRuntimeService;
  let redis: any;
  let prisma: any;
  let ocpi: any;
  let saved: Record<string, string>;
  const party = { id: "cpo-db", countryCode: "TW", partyId: "CPO", role: "CPO" };
  const location = { id: "loc", partyId: party.id, party, evses: [{ uid: "evse", rawJson: { connectors: [{ max_electric_power: 120000 }] } }] };
  const initial = (overrides = {}) => ({
    countryCode: "TW", partyId: "CPO", payload: { currency: "TWD", cdr_token: { uid: "TOKEN" } },
    state: { sessionId: "session", evseUid: "evse", locationId: "loc", startTime: new Date().toISOString(), soc: 15, kwh: 0, cost: 0, kw: 120, voltage: 400, current: 300, isAuto: true, emspId: "emsp-db", ...overrides },
  });
  beforeEach(() => {
    jest.useFakeTimers();
    saved = {};
    redis = { getClient: () => ({
      hgetall: jest.fn(async () => ({ ...saved })),
      hset: jest.fn(async (_key, uid, value) => { saved[uid] = value; }),
      hdel: jest.fn(async (_key, uid) => { delete saved[uid]; }),
    }) };
    prisma = {
      session: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ status: "ACTIVE" }) },
      location: { findFirst: jest.fn().mockResolvedValue(location), findUnique: jest.fn().mockResolvedValue(location) },
      party: { findUnique: jest.fn().mockResolvedValue({ id: "emsp-db", countryCode: "TW", partyId: "EMS", role: "EMSP", credential: { url: "http://example.test/ocpi" } }) },
    };
    const ok = () => jest.fn().mockResolvedValue({ status_code: 1000 });
    ocpi = { commands$: new Subject(), handlePutSession: ok(), handlePatchSession: ok(), handlePatchEvse: ok(), handlePostCdr: ok(), sendCommandResult: ok() };
    runtime = new ChargingRuntimeService(prisma, redis, ocpi);
  });
  afterEach(async () => { await runtime.onModuleDestroy(); jest.useRealTimers(); });

  it("advances and forwards without any event subscriber or open browser", async () => {
    await runtime.onModuleInit();
    await runtime.register(initial());
    ocpi.handlePutSession.mockClear();
    await jest.advanceTimersByTimeAsync(1600);
    expect(runtime.snapshot().evse.kwh).toBeGreaterThan(0);
    expect(ocpi.handlePutSession).toHaveBeenCalledTimes(1);
    expect(ocpi.handlePutSession.mock.calls[0][4].charging_periods[0].dimensions).toContainEqual({ type: "STATE_OF_CHARGE", volume: runtime.snapshot().evse.soc });
  });

  it("persists manual edits without forwarding, then publishes on demand", async () => {
    await runtime.onModuleInit();
    await runtime.register(initial({ isAuto: false }));
    ocpi.handlePutSession.mockClear();
    await runtime.update("evse", { fields: { soc: 42, kw: 50, kwh: 12 } });
    await jest.advanceTimersByTimeAsync(16000);
    expect(ocpi.handlePutSession).not.toHaveBeenCalled();
    expect(JSON.parse(saved.evse).soc).toBe(42);
    await runtime.update("evse", { fields: {}, push: true });
    expect(ocpi.handlePutSession).toHaveBeenCalledTimes(1);
    expect(runtime.snapshot().evse.cost).toBe(134);
  });

  it("restores mode and values after restart and sends a snapshot on reconnect", async () => {
    await runtime.register(initial({ isAuto: false, soc: 42 }));
    runtime = new ChargingRuntimeService(prisma, redis, ocpi);
    await runtime.onModuleInit();
    let event: any;
    const subscription = runtime.events$.subscribe((value) => { event = value; });
    expect(event.type).toBe("TELEMETRY_SNAPSHOT");
    expect(event.data.evse).toMatchObject({ soc: 42, isAuto: false });
    subscription.unsubscribe();
  });

  it("starts remote real eMSP sessions in the backend and uses 15 second intervals", async () => {
    await runtime.onModuleInit();
    ocpi.commands$.next({ type: "START_SESSION", data: { location_id: "loc", evse_uid: "evse", emsp_id: "emsp-db", authorization_reference: "AUTH", token: { uid: "REMOTE" }, response_url: "http://example.test/result" } });
    await jest.advanceTimersByTimeAsync(0);
    expect(runtime.snapshot().evse).toMatchObject({ sessionId: "AUTH", isAuto: true, intervalMs: 15000 });
    expect(ocpi.sendCommandResult).toHaveBeenCalledWith(expect.anything(), "http://example.test/result", "ACCEPTED");
    ocpi.handlePutSession.mockClear();
    await jest.advanceTimersByTimeAsync(15000);
    expect(ocpi.handlePutSession).toHaveBeenCalledTimes(1);
    expect(runtime.snapshot().evse.kwh).toBe(0.5);
  });

  it("retries settlement after CDR failure using the same CDR identifier", async () => {
    await runtime.onModuleInit();
    await runtime.register(initial());
    ocpi.handlePostCdr.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(runtime.stop("evse")).rejects.toThrow("queue unavailable");
    expect(runtime.snapshot().evse.isAuto).toBe(false);
    await jest.advanceTimersByTimeAsync(500);
    expect(ocpi.handlePostCdr).toHaveBeenCalledTimes(2);
    expect(ocpi.handlePostCdr.mock.calls.map((call) => call[1].id)).toEqual(["CDR-session", "CDR-session"]);
    expect(runtime.snapshot()).toEqual({});
  });

  it("keeps SCT ACTIVE through the buffer, pushes billing start once, and settles on unplug", async () => {
    const sct = { ...party, partyId: "SCT" };
    prisma.location.findFirst.mockResolvedValue({ ...location, party: sct });
    await runtime.onModuleInit();
    await runtime.register({ ...initial(), partyId: "SCT" });
    await runtime.stop("evse");
    expect(runtime.snapshot().evse).toMatchObject({ phase: "IDLE", status: "ACTIVE", kw: 0 });
    ocpi.handlePutSession.mockClear();
    await jest.advanceTimersByTimeAsync(59500);
    expect(ocpi.handlePutSession).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1500);
    expect(ocpi.handlePutSession).toHaveBeenCalledTimes(1);
    await runtime.stop("evse", true);
    expect(ocpi.handlePatchSession).toHaveBeenCalled();
    expect(ocpi.handlePostCdr.mock.calls[0][1].total_parking_cost.incl_vat).toBe(20);
    expect(runtime.snapshot()).toEqual({});
  });

  it("does not issue an SCT CDR when the COMPLETED patch fails", async () => {
    prisma.location.findFirst.mockResolvedValue({ ...location, party: { ...party, partyId: "SCT" } });
    await runtime.register({ ...initial(), partyId: "SCT" });
    ocpi.handlePatchSession.mockResolvedValueOnce({ status_code: 2001, status_message: "Unknown session" });
    await expect(runtime.stop("evse", true)).rejects.toThrow("Unknown session");
    expect(ocpi.handlePostCdr).not.toHaveBeenCalled();
  });

  it("rejects invalid telemetry and duplicate EVSE ownership", async () => {
    await runtime.register(initial());
    await expect(runtime.update("evse", { fields: { soc: 101 } })).rejects.toThrow();
    await expect(runtime.update("evse", { fields: { kwh: -1 } })).rejects.toThrow();
    await expect(runtime.update("evse", { fields: { kw: NaN } })).rejects.toThrow();
    await expect(runtime.register(initial({ sessionId: "second" }))).rejects.toThrow("EVSE already");
    expect(runtime.snapshot().evse.sessionId).toBe("session");
  });

  it("auto-completes at full battery and issues one settlement", async () => {
    await runtime.onModuleInit();
    await runtime.register(initial({ soc: 99.9 }));
    await jest.advanceTimersByTimeAsync(1500);
    expect(ocpi.handlePostCdr).toHaveBeenCalledTimes(1);
    expect(ocpi.handlePutSession.mock.calls[ocpi.handlePutSession.mock.calls.length - 1][4]).toMatchObject({ status: "COMPLETED" });
    expect(runtime.snapshot()).toEqual({});
  });

  it("keeps edited terminal status as a draft until manually sent", async () => {
    await runtime.onModuleInit();
    await runtime.register(initial({ isAuto: false }));
    ocpi.handlePutSession.mockClear();
    await runtime.update("evse", { fields: { status: "INVALID" } });
    await jest.advanceTimersByTimeAsync(2000);
    expect(ocpi.handlePutSession).not.toHaveBeenCalled();
    expect(ocpi.handlePostCdr).not.toHaveBeenCalled();
    await runtime.update("evse", { push: true });
    expect(ocpi.handlePostCdr).toHaveBeenCalledTimes(1);
  });

  it("does not reopen a session already settled by a remote STOP", async () => {
    await runtime.onModuleInit();
    await runtime.register(initial());
    ocpi.handlePutSession.mockClear();
    prisma.session.findUnique.mockResolvedValue({ status: "COMPLETED" });
    await jest.advanceTimersByTimeAsync(1500);
    expect(ocpi.handlePutSession).not.toHaveBeenCalled();
    expect(runtime.snapshot()).toEqual({});
  });
});
