import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PartyContext } from "../common/decorators/current-party.decorator";
import { Subject } from "rxjs";
import axios from "axios";
import { Prisma } from "@prisma/client";
import { EmspService } from "../emsp/emsp.service";
import { RoutingProducerService } from "./routing/routing-producer.service";

// OCPI 2.2.1 CommandResponse.timeout: seconds the eMSP should wait for the async CommandResult
const COMMAND_RESULT_TIMEOUT = 30;
const FINISHED_SESSION_STATUSES = ["COMPLETED", "INVALID"];

type SessionWithParty = Prisma.SessionGetPayload<{ include: { party: true } }>;

@Injectable()
export class OcpiService {
  private readonly logger = new Logger(OcpiService.name);
  public readonly commands$ = new Subject<{ type: string; data: any }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emspService: EmspService,
    private readonly routingProducerService: RoutingProducerService,
  ) {}

  // Response wrapper according to OCPI specification
  wrapResponse(data: any, statusCode = 1000, message = "Success") {
    return {
      data,
      status_code: statusCode,
      status_message: message,
      timeStamp: new Date().toISOString(),
    };
  }

  // Handle incoming PUT Location from CPO
  async handlePutLocation(
    party: PartyContext,
    countryCode: string,
    partyId: string,
    locationId: string,
    payload: any,
  ) {
    this.logger.log(
      `[Tenant: ${party.id}] Received PUT Location: ${locationId}`,
    );

    // Upsert the main Location record
    await this.prisma.location.upsert({
      where: {
        partyId_id: {
          partyId: party.id,
          id: locationId,
        },
      },
      create: {
        partyId: party.id,
        id: locationId,
        name: payload.name,
        address: payload.address,
        city: payload.city,
        postalCode: payload.postal_code,
        country: payload.country,
        coordinates: payload.coordinates || {},
        rawJson: payload,
      },
      update: {
        name: payload.name,
        address: payload.address,
        city: payload.city,
        postalCode: payload.postal_code,
        country: payload.country,
        coordinates: payload.coordinates || {},
        rawJson: payload,
      },
    });

    // Upsert associated EVSEs if they exist in the payload
    if (payload.evses && Array.isArray(payload.evses)) {
      for (const evse of payload.evses) {
        await this.prisma.evse.upsert({
          where: {
            locationPartyId_locationId_uid: {
              locationPartyId: party.id,
              locationId: locationId,
              uid: evse.uid,
            },
          },
          create: {
            locationPartyId: party.id,
            locationId: locationId,
            uid: evse.uid,
            id: evse.evse_id,
            status: evse.status,
            rawJson: evse,
          },
          update: {
            id: evse.evse_id,
            status: evse.status,
            rawJson: evse,
          },
        });
      }
    }

    // Forward the location sync call to EMSP via event queue
    await this.routingProducerService.enqueueForwardTask(
      "PUT",
      `locations/${countryCode}/${partyId}/${locationId}`,
      payload,
      countryCode,
      partyId,
    );

    return this.wrapResponse(null, 1000, "Location successfully updated");
  }

  // Handle incoming PATCH EVSE from CPO
  async handlePatchEvse(
    party: PartyContext,
    countryCode: string,
    partyId: string,
    locationId: string,
    evseUid: string,
    payload: any,
  ) {
    this.logger.log(
      `[Tenant: ${party.id}] Received PATCH EVSE: ${evseUid} for location: ${locationId}`,
    );

    const existingEvse = await this.prisma.evse.findUnique({
      where: {
        locationPartyId_locationId_uid: {
          locationPartyId: party.id,
          locationId: locationId,
          uid: evseUid,
        },
      },
    });

    const updatedRawJson = {
      ...((existingEvse?.rawJson && typeof existingEvse.rawJson === "object"
        ? (existingEvse.rawJson as object)
        : {})),
      ...(payload && typeof payload === "object" ? payload : {}),
    };

    await this.prisma.evse.upsert({
      where: {
        locationPartyId_locationId_uid: {
          locationPartyId: party.id,
          locationId: locationId,
          uid: evseUid,
        },
      },
      create: {
        locationPartyId: party.id,
        locationId: locationId,
        uid: evseUid,
        status: payload.status || "UNKNOWN",
        rawJson: payload,
      },
      update: {
        status: payload.status || existingEvse?.status || "UNKNOWN",
        rawJson: updatedRawJson,
      },
    });

    // Forward the EVSE status update patch to EMSP via event queue
    await this.routingProducerService.enqueueForwardTask(
      "PATCH",
      `locations/${countryCode}/${partyId}/${locationId}/${evseUid}`,
      payload,
      countryCode,
      partyId,
    );

    return this.wrapResponse(null, 1000, "EVSE status successfully updated");
  }

  // Handle incoming PUT Tariff from CPO
  async handlePutTariff(
    party: PartyContext,
    countryCode: string,
    partyId: string,
    tariffId: string,
    payload: any,
  ) {
    this.logger.log(`[Tenant: ${party.id}] Received PUT Tariff: ${tariffId}`);

    // Forward the Tariff sync to EMSP via event queue
    await this.routingProducerService.enqueueForwardTask(
      "PUT",
      `tariffs/${countryCode}/${partyId}/${tariffId}`,
      payload,
      countryCode,
      partyId,
    );

    return this.wrapResponse(null, 1000, "Tariff successfully processed");
  }

  // Handle incoming PUT Session from CPO
  async handlePutSession(
    party: PartyContext,
    countryCode: string,
    partyId: string,
    sessionId: string,
    payload: any,
    toPartyId?: string,
    toCountryCode?: string,
  ) {
    this.logger.log(`[Tenant: ${party.id}] Received PUT Session: ${sessionId}`);

    // A session settled by the HUB (e.g. remote STOP_SESSION) must not be reopened by late telemetry
    const existingSession = await this.prisma.session.findUnique({
      where: { partyId_id: { partyId: party.id, id: sessionId } },
    });
    if (
      existingSession &&
      FINISHED_SESSION_STATUSES.includes(existingSession.status) &&
      !FINISHED_SESSION_STATUSES.includes(payload.status)
    ) {
      this.logger.warn(
        `[Tenant: ${party.id}] Ignored PUT Session ${sessionId} (${payload.status}): session is already ${existingSession.status}`,
      );
      return this.wrapResponse(null, 1000, "Session already finished; update ignored");
    }

    // If toPartyId & toCountryCode are provided, find matching EMSP to record emsp_id in rawJson
    if (toPartyId && toCountryCode && !payload.emsp_id) {
      try {
        const emspParty = await this.prisma.party.findFirst({
          where: {
            countryCode: toCountryCode.toUpperCase(),
            partyId: toPartyId.toUpperCase(),
            role: "EMSP",
          },
        });
        if (emspParty) {
          payload.emsp_id = emspParty.id;
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to map EMSP in handlePutSession: ${err.message}`,
        );
      }
    }

    await this.prisma.session.upsert({
      where: {
        partyId_id: {
          partyId: party.id,
          id: sessionId,
        },
      },
      create: {
        partyId: party.id,
        id: sessionId,
        locationId: payload.location_id || payload.location?.id || "unknown",
        evseUid: payload.evse_uid || payload.evse?.uid || "unknown",
        status: payload.status || "PENDING",
        kwh: payload.kwh || 0.0,
        rawJson: payload,
      },
      update: {
        locationId: payload.location_id || payload.location?.id || "unknown",
        evseUid: payload.evse_uid || payload.evse?.uid || "unknown",
        status: payload.status,
        kwh: payload.kwh || 0.0,
        rawJson: payload,
      },
    });

    // Forward the Session update to EMSP via event queue
    await this.routingProducerService.enqueueForwardTask(
      "PUT",
      `sessions/${countryCode}/${partyId}/${sessionId}`,
      payload,
      countryCode,
      partyId,
      toCountryCode,
      toPartyId,
    );

    return this.wrapResponse(null, 1000, "Session successfully updated");
  }

  // Handle incoming POST CDR from CPO
  async handlePostCdr(
    party: PartyContext,
    payload: any,
    toPartyId?: string,
    toCountryCode?: string,
  ) {
    const cdrId = payload.id;
    this.logger.log(`[Tenant: ${party.id}] Received POST CDR: ${cdrId}`);

    if (!cdrId) {
      return this.wrapResponse(null, 2001, "Missing CDR ID");
    }

    await this.prisma.cdr.upsert({
      where: {
        partyId_id: {
          partyId: party.id,
          id: cdrId,
        },
      },
      create: {
        partyId: party.id,
        id: cdrId,
        rawJson: payload,
      },
      update: {
        rawJson: payload,
      },
    });

    // Forward the CDR record to EMSP via event queue
    await this.routingProducerService.enqueueForwardTask(
      "POST",
      "cdrs",
      payload,
      party.countryCode,
      party.partyId,
      toCountryCode,
      toPartyId,
    );

    return this.wrapResponse(null, 1000, "CDR successfully created");
  }

  // Handle incoming start session command from EMSP
  async handleStartSession(party: PartyContext, payload: any) {
    this.logger.log(
      `[Tenant: ${party.id}] Received START_SESSION Command from EMSP: ${JSON.stringify(payload, null, 2)}`,
    );

    this.commands$.next({
      type: "START_SESSION",
      data: {
        ...payload,
        emsp_id: party.id,
      },
    });

    return this.wrapResponse(
      {
        result: "ACCEPTED",
        timeout: COMMAND_RESULT_TIMEOUT,
      },
      1000,
      "Start session request accepted",
    );
  }

  // Handle incoming stop session command from EMSP.
  // The HUB settles the session itself (session COMPLETED -> EVSE AVAILABLE -> CDR -> CommandResult),
  // so a remote stop works whether or not the simulator UI is open.
  async handleStopSession(party: PartyContext, payload: any) {
    this.logger.log(
      `[Tenant: ${party.id}] Received STOP_SESSION Command from EMSP: ${JSON.stringify(payload, null, 2)}`,
    );

    const sessionId = payload?.session_id;
    if (!sessionId) {
      return this.wrapResponse(null, 2001, "Missing session_id");
    }

    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, status: "ACTIVE", party: { role: "CPO" } },
      include: { party: true },
    });
    const ownerEmspId = (session?.rawJson as any)?.emsp_id;

    // Only the eMSP that owns the session may stop it; anything else is indistinguishable from unknown
    if (!session || (ownerEmspId && ownerEmspId !== party.id)) {
      return this.wrapResponse(
        { result: "UNKNOWN_SESSION", timeout: COMMAND_RESULT_TIMEOUT },
        1000,
        "Unknown session",
      );
    }

    const now = new Date().toISOString();
    const completedPayload = {
      ...(session.rawJson as Record<string, any>),
      status: "COMPLETED",
      end_date_time: now,
      last_updated: now,
    };

    // Atomic ACTIVE -> COMPLETED transition, so duplicate STOPs cannot settle the session twice
    const { count } = await this.prisma.session.updateMany({
      where: { partyId: session.partyId, id: session.id, status: "ACTIVE" },
      data: { status: "COMPLETED", rawJson: completedPayload },
    });
    if (count === 0) {
      return this.wrapResponse(
        { result: "REJECTED", timeout: COMMAND_RESULT_TIMEOUT },
        1000,
        "Session is already being stopped",
      );
    }

    // Answer the command synchronously and deliver the outcome through response_url
    setImmediate(() => {
      void this.settleStoppedSession(party, session, completedPayload, payload.response_url);
    });

    return this.wrapResponse(
      {
        result: "ACCEPTED",
        timeout: COMMAND_RESULT_TIMEOUT,
      },
      1000,
      "Stop session request accepted",
    );
  }

  private async settleStoppedSession(
    emsp: PartyContext,
    session: SessionWithParty,
    completedPayload: Record<string, any>,
    responseUrl?: string,
  ) {
    const cpo: PartyContext = {
      id: session.party.id,
      countryCode: session.party.countryCode,
      partyId: session.party.partyId,
      role: session.party.role,
    };
    let cdrId: string | undefined;
    let result = "ACCEPTED";

    try {
      // 1. Push the finished session to the eMSP that stopped it
      await this.routingProducerService.enqueueForwardTask(
        "PUT",
        `sessions/${cpo.countryCode}/${cpo.partyId}/${session.id}`,
        completedPayload,
        cpo.countryCode,
        cpo.partyId,
        emsp.countryCode,
        emsp.partyId,
      );

      // 2. Free the EVSE (best effort: the location may not be registered in the HUB)
      try {
        await this.handlePatchEvse(
          cpo,
          cpo.countryCode,
          cpo.partyId,
          session.locationId,
          session.evseUid,
          { status: "AVAILABLE", last_updated: completedPayload.last_updated },
        );
      } catch (err: any) {
        this.logger.warn(
          `Could not release EVSE ${session.evseUid} after stopping ${session.id}: ${err.message}`,
        );
      }

      // 3. Issue the CDR
      const cdr = this.buildCdr(cpo, session, completedPayload);
      cdrId = cdr.id;
      await this.handlePostCdr(cpo, cdr, emsp.partyId, emsp.countryCode);
      this.logger.log(`Session ${session.id} stopped by EMSP ${emsp.partyId}; CDR ${cdr.id} issued`);
    } catch (err: any) {
      result = "FAILED";
      this.logger.error(`Failed to settle stopped session ${session.id}: ${err.message}`, err.stack);
    }

    await this.sendCommandResult(emsp, responseUrl, result);

    // Let the simulator UI drop its local tracker and refresh
    this.commands$.next({
      type: "SESSION_STOPPED",
      data: {
        session_id: session.id,
        location_id: session.locationId,
        evse_uid: session.evseUid,
        emsp_id: emsp.id,
        cdr_id: cdrId,
        result,
      },
    });
  }

  private buildCdr(cpo: PartyContext, session: SessionWithParty, completedPayload: Record<string, any>) {
    const startDateTime = completedPayload.start_date_time || session.createdAt.toISOString();
    const endDateTime = completedPayload.end_date_time;

    return {
      country_code: cpo.countryCode,
      party_id: cpo.partyId,
      ctr_code: cpo.countryCode,
      id: `CDR-${session.id}`,
      start_date_time: startDateTime,
      end_date_time: endDateTime,
      session_id: session.id,
      cdr_token: completedPayload.cdr_token,
      auth_method: completedPayload.auth_method || "COMMAND",
      authorization_reference: completedPayload.authorization_reference || session.id,
      cdr_location: {
        id: session.locationId,
        evse_uid: session.evseUid,
        connector_id: completedPayload.connector_id,
      },
      currency: completedPayload.currency || "TWD",
      charging_periods: completedPayload.charging_periods || [],
      total_cost: completedPayload.total_cost || { excl_vat: 0, incl_vat: 0 },
      total_energy: session.kwh,
      kwh: session.kwh,
      // Seconds, matching the CDRs generated by the simulator UI
      total_time: Math.floor(
        (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 1000,
      ),
      emsp_id: completedPayload.emsp_id,
      last_updated: endDateTime,
    };
  }

  // Async CommandResult (OCPI 2.2.1 commands module) posted to the eMSP's response_url
  private async sendCommandResult(emsp: PartyContext, responseUrl: string | undefined, result: string) {
    if (!responseUrl) return;

    try {
      const credential = await this.prisma.credential.findUnique({
        where: { partyId: emsp.id },
      });
      await axios.post(
        responseUrl,
        { result },
        {
          timeout: 5000,
          headers: {
            Authorization: `Bearer ${credential?.tokenB || ""}`,
            "Content-Type": "application/json; charset=utf-8",
            "OCPI-to-party-id": emsp.partyId,
            "OCPI-to-country-code": emsp.countryCode,
            "OCPI-from-party-id": "HUB",
            "OCPI-from-country-code": "TW",
          },
        },
      );
      this.logger.log(`CommandResult ${result} sent to ${responseUrl}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send CommandResult to ${responseUrl}: ${
          err.response?.data ? JSON.stringify(err.response.data) : err.message
        }`,
      );
    }
  }

  // Synchronize/Forward all locations in the DB to all enabled EMSPs on-demand
  async syncAllLocations() {
    return this.emspService.syncLocationsToEmsp();
  }
}
