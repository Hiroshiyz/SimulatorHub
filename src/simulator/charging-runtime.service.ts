import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { BehaviorSubject, Subscription } from "rxjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { OcpiService } from "../ocpi/ocpi.service";
import { buildSctTariff, computeIdleFee, sctBufferMinutes, sctEnergyCost, secondsToHours } from "../common/sct-idle-fee";

interface RuntimeSession {
  sessionId: string;
  evseUid: string;
  locationId: string;
  startTime: string;
  soc: number;
  kwh: number;
  cost: number;
  kw: number;
  targetKw: number;
  voltage: number;
  current: number;
  isAuto: boolean;
  status: string;
  phase?: string;
  chargingEndTime?: string;
  idleBillingPushed?: boolean;
  billingProfile?: string;
  tariffSnapshot?: ReturnType<typeof buildSctTariff>;
  emspId?: string;
  authorizationReference?: string;
  tokenUid?: string;
  cdrToken?: any;
  countryCode: string;
  partyId: string;
  ownerId: string;
  intervalMs: number;
  simulatedSeconds: number;
  lastTick: number;
  energyPrice: number;
  payload: Record<string, any>;
  initialized?: boolean;
  settlement?: { endTime: string; cdr: any; sessionPushed?: boolean; evseReleased?: boolean };
}

// One runtime per server process. Redis preserves the simulation across server restarts.
@Injectable()
export class ChargingRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChargingRuntimeService.name);
  private readonly key = "simulator:charging-runtime:v1";
  private readonly sessions = new Map<string, RuntimeSession>();
  readonly events$ = new BehaviorSubject({ type: "TELEMETRY_SNAPSHOT", data: {} });
  private timer?: ReturnType<typeof setInterval>;
  private subscription?: Subscription;
  private queue: Promise<unknown> = Promise.resolve();
  private ticking = false;

  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly ocpi: OcpiService) {}

  async onModuleInit() {
    const saved = await this.redis.getClient().hgetall(this.key);
    for (const [uid, value] of Object.entries(saved)) {
      const session = JSON.parse(value) as RuntimeSession;
      // Downtime pauses charging, but the real SCT idle buffer continues to elapse.
      session.lastTick = Date.now();
      this.sessions.set(uid, session);
    }
    // Adopt ACTIVE sessions created before the backend runtime was introduced.
    const active = await this.prisma.session.findMany({ where: { status: "ACTIVE", party: { role: "CPO" } }, include: { party: true } });
    for (const row of active) {
      if (this.sessions.has(row.evseUid)) continue;
      const payload = (row.rawJson || {}) as Record<string, any>;
      const dimensions = payload.charging_periods?.flatMap((p: any) => p.dimensions || []) || [];
      const value = (type: string, fallback: number) => dimensions.find((d: any) => d.type === type)?.volume ?? fallback;
      const emsp = payload.emsp_id ? await this.prisma.party.findUnique({ where: { id: payload.emsp_id }, include: { credential: true } }) : null;
      try {
        await this.registerInternal({ countryCode: row.party.countryCode, partyId: row.party.partyId,
          realTime: Boolean(emsp && !emsp.credential?.url?.includes("/mock-emsp/")), payload,
          state: { sessionId: row.id, evseUid: row.evseUid, locationId: row.locationId, startTime: payload.start_date_time || row.createdAt.toISOString(),
            soc: value("STATE_OF_CHARGE", 15), kwh: row.kwh, cost: payload.total_cost?.incl_vat || 0, kw: value("POWER", 120), current: value("CURRENT", 300), voltage: value("VOLTAGE", 400),
            isAuto: true, emspId: payload.emsp_id, tokenUid: payload.auth_token_uid, cdrToken: payload.cdr_token, authorizationReference: payload.authorization_reference },
        });
      } catch (error: any) { this.logger.warn(`Could not adopt ${row.id}: ${error.message}`); }
    }
    this.publish();
    this.subscription = this.ocpi.commands$.subscribe((event) => {
      void this.exclusive(async () => {
        if (event.type === "START_SESSION") await this.remoteStart(event.data);
        if (event.type === "SESSION_STOPPED") {
          const session = this.sessions.get(event.data.evse_uid);
          if (session?.sessionId === event.data.session_id) await this.remove(session.evseUid);
        }
        if (event.type === "SESSION_CHARGING_STOPPED") {
          const session = this.sessions.get(event.data.evse_uid);
          if (session?.sessionId === event.data.session_id) await this.idle(session);
        }
      }).catch(async (error) => {
        this.logger.error(`Command simulation failed: ${error.message}`);
        if (event.type === "START_SESSION") {
          const emsp = await this.prisma.party.findUnique({ where: { id: event.data.emsp_id } });
          if (emsp) await this.ocpi.sendCommandResult(emsp, event.data.response_url, "FAILED");
        }
      });
    });
    this.timer = setInterval(() => {
      if (this.ticking) return;
      this.ticking = true;
      void this.exclusive(() => this.tick()).catch((error) => this.logger.error(error.message))
        .finally(() => { this.ticking = false; });
    }, 500);
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    this.subscription?.unsubscribe();
    await this.queue;
  }

  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }

  snapshot() {
    return Object.fromEntries([...this.sessions].map(([uid, session]) => {
      const { payload, ownerId, settlement, ...state } = session;
      return [uid, state];
    }));
  }

  private publish() { this.events$.next({ type: "TELEMETRY_SNAPSHOT", data: this.snapshot() }); }
  private async save(session: RuntimeSession) {
    await this.redis.getClient().hset(this.key, session.evseUid, JSON.stringify(session));
    this.sessions.set(session.evseUid, session);
    this.publish();
  }
  private async remove(uid: string) {
    await this.redis.getClient().hdel(this.key, uid);
    this.sessions.delete(uid);
    this.publish();
  }

  register(body: any) { return this.exclusive(() => this.registerInternal(body)); }
  private async registerInternal(body: any) {
    const state = body.state;
    if (!state?.evseUid || !state.sessionId || !state.locationId) throw new BadRequestException("Missing session identity");
    const existing = this.sessions.get(state.evseUid);
    if (existing) {
      if (existing.sessionId === state.sessionId) { await this.initialize(existing); return this.snapshot(); }
      throw new ConflictException("EVSE already has a running simulation");
    }
    const location = await this.prisma.location.findFirst({
      where: { id: state.locationId, party: { countryCode: body.countryCode, partyId: body.partyId, role: "CPO" } },
      include: { party: true, evses: true },
    });
    if (!location || !location.evses.some((e) => e.uid === state.evseUid)) throw new NotFoundException("Unknown EVSE");
    const session: RuntimeSession = {
      ...state, countryCode: location.party.countryCode, partyId: location.party.partyId, ownerId: location.partyId,
      intervalMs: body.realTime ? 15000 : 1500, simulatedSeconds: body.realTime ? 15 : 60,
      lastTick: Date.now(), energyPrice: Number.isFinite(body.energyPrice) ? body.energyPrice : 9.5,
      targetKw: state.kw, payload: body.payload || {}, isAuto: state.isAuto !== false, status: "ACTIVE",
    };
    // Internal initialization and settlement checkpoints cannot be supplied by callers.
    session.initialized = false;
    delete session.settlement;
    const stored = await this.prisma.session.findUnique({ where: { partyId_id: { partyId: session.ownerId, id: session.sessionId } } });
    if (stored && (["COMPLETED", "INVALID"].includes(stored.status) || (stored.evseUid && stored.evseUid !== session.evseUid))) {
      throw new ConflictException("Session ID is already in use or completed");
    }
    this.validate(session);
    if (![session.soc, session.kwh, session.kw, session.voltage, session.current, session.cost].every(Number.isFinite) || !Number.isFinite(Date.parse(session.startTime))) {
      throw new BadRequestException("Missing or invalid initial telemetry");
    }
    if (session.partyId.toUpperCase() === "SCT") {
      session.billingProfile = "SCT";
      session.phase ||= "CHARGING";
      session.tariffSnapshot ||= buildSctTariff(new Date(session.startTime));
    }
    await this.save(session);
    await this.initialize(session);
    return this.snapshot();
  }

  private validate(fields: any) {
    for (const name of ["soc", "kwh", "kw", "current", "voltage", "energyPrice"]) {
      if (fields[name] !== undefined && (typeof fields[name] !== "number" || !Number.isFinite(fields[name]) || fields[name] < 0)) {
        throw new BadRequestException(`Invalid ${name}`);
      }
    }
    if (fields.soc > 100) throw new BadRequestException("SoC must be between 0 and 100");
    if (fields.isAuto !== undefined && typeof fields.isAuto !== "boolean") throw new BadRequestException("Invalid isAuto");
    if (fields.status && !["ACTIVE", "COMPLETED", "INVALID"].includes(fields.status)) throw new BadRequestException("Invalid status");
  }

  update(uid: string, body: any) {
    return this.exclusive(async () => {
      const session = this.sessions.get(uid);
      if (!session) throw new NotFoundException("Simulation not found");
      if (body.sessionId && body.sessionId !== session.sessionId) throw new ConflictException("Session changed");
      if (session.settlement) throw new ConflictException("Session is settling; retry stop/unplug");
      const fields = body.fields || {};
      this.validate(fields);
      const next = { ...session };
      for (const name of ["soc", "kwh", "kw", "current", "voltage", "isAuto", "status", "energyPrice"]) {
        if (fields[name] !== undefined) (next as any)[name] = fields[name];
      }
      if (fields.kw !== undefined) next.targetKw = fields.kw;
      next.cost = this.cost(next);
      if (fields.isAuto !== undefined) next.lastTick = Date.now();
      await this.save(next);
      if (body.push && ["COMPLETED", "INVALID"].includes(next.status)) await this.finish(next);
      else if (body.push) await this.push(next);
      return this.snapshot();
    });
  }

  stop(uid: string, unplug = false, expectedSessionId?: string) {
    return this.exclusive(async () => {
      const session = this.sessions.get(uid);
      if (!session) throw new NotFoundException("Simulation not found");
      if (expectedSessionId && session.sessionId !== expectedSessionId) throw new ConflictException("Session changed");
      if (session.billingProfile === "SCT" && !unplug && !session.settlement) await this.idle(session);
      else await this.finish(session);
      return this.snapshot();
    });
  }

  private cost(s: RuntimeSession) {
    return s.tariffSnapshot ? sctEnergyCost(s.tariffSnapshot, s.kwh, new Date(s.startTime)) : Math.round(20 + s.kwh * s.energyPrice);
  }
  private price(s: RuntimeSession, cost: number) { return { excl_vat: s.billingProfile === "SCT" ? cost : Math.round(cost * 0.95), incl_vat: cost }; }
  private periods(s: RuntimeSession, until: Date) {
    const end = new Date(s.chargingEndTime || until);
    const idle = computeIdleFee(s.tariffSnapshot!, end, until);
    return { idle, periods: [
      { start_date_time: s.startTime, dimensions: [{ type: "ENERGY", volume: s.kwh }, { type: "TIME", volume: secondsToHours((end.getTime() - new Date(s.startTime).getTime()) / 1000) }], tariff_id: s.tariffSnapshot!.id },
      ...idle.periods.map((p) => ({ start_date_time: p.start.toISOString(), dimensions: [{ type: "PARKING_TIME", volume: secondsToHours((p.end.getTime() - p.start.getTime()) / 1000) }], tariff_id: "" })),
    ] };
  }
  private payload(s: RuntimeSession): Record<string, any> {
    return { ...s.payload, id: s.sessionId, start_date_time: s.startTime, location_id: s.locationId, evse_uid: s.evseUid,
      country_code: s.countryCode, party_id: s.partyId, kwh: s.kwh, status: s.status,
      emsp_id: s.emspId, ...(s.authorizationReference ? { authorization_reference: s.authorizationReference } : {}),
      ...(s.cdrToken ? { cdr_token: s.cdrToken } : {}),
      total_cost: this.price(s, s.cost), charging_periods: [{ start_date_time: s.startTime,
        dimensions: [{ type: "STATE_OF_CHARGE", volume: s.soc }, { type: "ENERGY", volume: s.kwh }, { type: "POWER", volume: s.kw }, { type: "CURRENT", volume: s.current }, { type: "VOLTAGE", volume: s.voltage }],
        ...(s.tariffSnapshot ? { tariff_id: s.tariffSnapshot.id } : {}),
      }], last_updated: new Date().toISOString() };
  }
  private party(s: RuntimeSession) { return { id: s.ownerId, countryCode: s.countryCode, partyId: s.partyId, role: "CPO" }; }
  private async target(s: RuntimeSession) {
    return s.emspId ? this.prisma.party.findUnique({ where: { id: s.emspId } }) : null;
  }
  private async push(s: RuntimeSession, payload = this.payload(s)) {
    const emsp = await this.target(s);
    this.check(await this.ocpi.handlePutSession(this.party(s), s.countryCode, s.partyId, s.sessionId, payload, emsp?.partyId, emsp?.countryCode));
  }
  private async idle(s: RuntimeSession) {
    if (s.phase === "IDLE") return;
    await this.save({ ...s, phase: "IDLE", chargingEndTime: new Date().toISOString(), kw: 0, current: 0 });
  }

  private async tick() {
    for (const session of [...this.sessions.values()]) {
      try {
        if (!session.initialized) { await this.initialize(session); continue; }
        const stored = await this.prisma.session.findUnique({ where: { partyId_id: { partyId: session.ownerId, id: session.sessionId } } });
        if (stored && ["COMPLETED", "INVALID"].includes(stored.status) && !session.settlement) {
          await this.remove(session.evseUid); continue;
        }
        if (session.settlement) { await this.finish(session); continue; }
        if (session.phase === "IDLE") {
          const bufferEnd = new Date(new Date(session.chargingEndTime!).getTime() + sctBufferMinutes() * 60000);
          if (!session.idleBillingPushed && Date.now() >= bufferEnd.getTime()) {
            const { periods } = this.periods(session, bufferEnd);
            await this.push(session, { ...this.payload(session), charging_periods: [...periods, { start_date_time: bufferEnd.toISOString(), dimensions: [{ type: "PARKING_TIME", volume: 0 }], tariff_id: "" }], last_updated: bufferEnd.toISOString().replace(/\.\d{3}Z$/, "Z") });
            await this.save({ ...session, idleBillingPushed: true });
          }
          continue;
        }
        if (session.status !== "ACTIVE" || !session.isAuto || Date.now() - session.lastTick < session.intervalMs) continue;
        const next = { ...session, lastTick: Date.now() };
        const power = session.simulatedSeconds === 60 ? Math.round((session.targetKw ?? session.kw) * (0.85 + Math.random() * 0.15) * 10) / 10 : (session.targetKw ?? session.kw);
        const added = Math.min(power * session.simulatedSeconds / 3600, (100 - session.soc) / 100 * 80);
        next.kwh = Math.round((session.kwh + added) * 1000) / 1000;
        next.soc = Math.min(100, Math.round((session.soc + added / 80 * 100) * 1000) / 1000);
        next.kw = power;
        next.current = session.voltage > 0 ? Math.round(power * 1000 / session.voltage * 10) / 10 : 0;
        next.cost = this.cost(next);
        if (next.soc >= 100) {
          next.kw = next.current = 0;
          await this.save(next);
          if (next.billingProfile === "SCT") { await this.push(next); await this.idle(next); }
          else await this.finish(next);
        } else {
          // Commit the meter reading only after forwarding is queued; retry the same step on failure.
          await this.push(next);
          await this.save(next);
        }
      } catch (error: any) { this.logger.error(`Telemetry ${session.sessionId}: ${error.message}`); }
    }
  }

  private async finish(s: RuntimeSession) {
    const emsp = await this.target(s);
    if (!s.settlement) {
      const now = new Date();
      const end = now.toISOString();
      const energyCost = this.cost(s);
      const idle = s.billingProfile === "SCT" ? this.periods({ ...s, chargingEndTime: s.chargingEndTime || end }, now) : null;
      const payload = this.payload(s);
      const location = await this.prisma.location.findUnique({ where: { partyId_id: { partyId: s.ownerId, id: s.locationId } }, include: { evses: true } });
      const evse = location?.evses.find((e) => e.uid === s.evseUid);
      const connector = (evse?.rawJson as any)?.connectors?.[0];
      const cdr = {
        ...payload, id: `CDR-${s.sessionId}`, session_id: s.sessionId, end_date_time: end,
        authorization_reference: s.authorizationReference || s.sessionId,
        currency: payload.currency || "TWD", total_energy: s.kwh,
        total_time: secondsToHours((now.getTime() - new Date(s.startTime).getTime()) / 1000),
        cdr_location: { id: s.locationId, name: location?.name, address: location?.address, city: location?.city, country: location?.country, coordinates: location?.coordinates,
          evse_uid: s.evseUid, evse_id: evse?.id || s.evseUid, connector_id: payload.connector_id || "1", connector_standard: connector?.standard, connector_format: connector?.format, connector_power_type: connector?.power_type },
        total_cost: this.price(s, energyCost + (idle?.idle.idleCost || 0)),
        ...(idle ? { tariffs: [s.tariffSnapshot], charging_periods: idle.periods, total_energy_cost: this.price(s, energyCost), total_parking_time: secondsToHours(idle.idle.idleSeconds), total_parking_cost: this.price(s, idle.idle.idleCost) } : {}),
        last_updated: end,
      };
      s = { ...s, isAuto: false, kw: 0, current: 0, status: s.status === "INVALID" ? "INVALID" : "COMPLETED", settlement: { endTime: end, cdr } };
      await this.save(s);
    }
    const settlement = s.settlement!;
    if (!settlement.sessionPushed) {
      const payload = { ...this.payload(s), end_date_time: settlement.endTime, total_cost: settlement.cdr.total_cost, last_updated: settlement.endTime };
      if (s.billingProfile === "SCT") this.check(await this.ocpi.handlePatchSession(this.party(s), s.countryCode, s.partyId, s.sessionId, { status: s.status, end_date_time: settlement.endTime, kwh: s.kwh, total_cost: payload.total_cost, last_updated: settlement.endTime }, emsp?.partyId, emsp?.countryCode));
      else await this.push(s, payload);
      settlement.sessionPushed = true;
      await this.save(s);
    }
    if (!settlement.evseReleased) {
      await this.ocpi.handlePatchEvse(this.party(s), s.countryCode, s.partyId, s.locationId, s.evseUid, { status: "AVAILABLE", last_updated: settlement.endTime });
      settlement.evseReleased = true;
      await this.save(s);
    }
    this.check(await this.ocpi.handlePostCdr(this.party(s), settlement.cdr, emsp?.partyId, emsp?.countryCode));
    await this.remove(s.evseUid);
  }

  private async remoteStart(data: any) {
    if (!data.evse_uid || !data.location_id) throw new BadRequestException("Remote start requires location_id and evse_uid");
    if (this.sessions.has(data.evse_uid)) throw new ConflictException("EVSE already charging");
    const location = await this.prisma.location.findFirst({ where: { id: data.location_id, evses: { some: { uid: data.evse_uid } } }, include: { party: true, evses: true } });
    if (!location) throw new NotFoundException("Unknown location");
    const emsp = await this.prisma.party.findUnique({ where: { id: data.emsp_id }, include: { credential: true } });
    const realTime = !emsp?.credential?.url?.includes("/mock-emsp/");
    const kw = (location.evses.find((e) => e.uid === data.evse_uid)?.rawJson as any)?.connectors?.[0]?.max_electric_power / 1000 || 120;
    const now = new Date().toISOString();
    const sessionId = data.authorization_reference || `SIM-${randomUUID()}`;
    await this.registerInternal({ countryCode: location.party.countryCode, partyId: location.party.partyId, realTime,
      state: { sessionId, evseUid: data.evse_uid, locationId: data.location_id, startTime: now, soc: 15, kwh: 0, cost: 0, kw, voltage: 400, current: kw * 1000 / 400, isAuto: true, emspId: data.emsp_id, authorizationReference: data.authorization_reference, tokenUid: data.token?.uid, cdrToken: data.token },
      payload: { cdr_token: data.token, auth_method: "COMMAND", connector_id: data.connector_id || "1", currency: "TWD" },
    });
    if (emsp) await this.ocpi.sendCommandResult(emsp, data.response_url, "ACCEPTED");
  }

  private check(result: { status_code: number; status_message?: string }) {
    if (result.status_code !== 1000) throw new BadRequestException(result.status_message || "OCPI operation failed");
  }

  private async initialize(session: RuntimeSession) {
    if (session.initialized) return;
    await this.ocpi.handlePatchEvse(this.party(session), session.countryCode, session.partyId, session.locationId, session.evseUid, { status: "CHARGING", last_updated: new Date().toISOString() });
    await this.push(session);
    await this.save({ ...session, initialized: true });
  }
}
