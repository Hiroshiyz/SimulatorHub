import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PartyContext } from "../common/decorators/current-party.decorator";
import axios from "axios";
import { Subject } from "rxjs";

@Injectable()
export class OcpiService {
  private readonly logger = new Logger(OcpiService.name);
  public readonly commands$ = new Subject<{ type: string; data: any }>();

  constructor(private readonly prisma: PrismaService) {}

  // Response wrapper according to OCPI specification
  wrapResponse(data: any, statusCode = 1000, message = "Success") {
    return {
      data,
      status_code: statusCode,
      status_message: message,
      timeStamp: new Date().toISOString(),
    };
  }

  // Helper method to automatically forward CPO updates to all registered EMSP tenants
  private async forwardToEmsps(
    method: "POST" | "PUT" | "PATCH",
    subPath: string,
    payload: any,
  ) {
    try {
      const emspParties = await this.prisma.party.findMany({
        where: { role: "EMSP" },
        include: { credential: true },
      });

      for (const emsp of emspParties) {
        if (emsp.credential && emsp.credential.url && emsp.credential.tokenC) {
          const url = `${emsp.credential.url}/ocpi/2.2.1/${subPath}`;
          const headers = {
            Authorization: `bearer ${emsp.credential.tokenC}`, // Use Token C provided by EMSP
            "Content-Type": "application/json; charset=utf-8",
            "OCPI-to-party-id": emsp.partyId,
            "OCPI-to-country-code": emsp.countryCode,
            "OCPI-from-party-id": "HUB",
            "OCPI-from-country-code": "TW",
          };

          this.logger.log(
            `Forwarding ${method} to EMSP ${emsp.partyId} at: ${url}`,
          );

          try {
            if (method === "PUT") {
              await axios.put(url, payload, { headers });
            } else if (method === "PATCH") {
              await axios.patch(url, payload, { headers });
            } else if (method === "POST") {
              await axios.post(url, payload, { headers });
            }
          } catch (err: any) {
            this.logger.error(
              `Failed to forward to EMSP ${emsp.partyId}: ${
                err.response?.data
                  ? JSON.stringify(err.response.data)
                  : err.message
              }`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in forwardToEmsps utility: ${err.message}`);
    }
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

    // Forward the location sync call to EMSP
    await this.forwardToEmsps(
      "PUT",
      `locations/${countryCode}/${partyId}/${locationId}`,
      payload,
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
        status: payload.status,
        rawJson: payload,
      },
    });

    // Forward the EVSE status update patch to EMSP
    await this.forwardToEmsps(
      "PATCH",
      `locations/${countryCode}/${partyId}/${locationId}/${evseUid}`,
      payload,
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

    // Forward the Tariff sync to EMSP
    await this.forwardToEmsps(
      "PUT",
      `tariffs/${countryCode}/${partyId}/${tariffId}`,
      payload,
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
  ) {
    this.logger.log(`[Tenant: ${party.id}] Received PUT Session: ${sessionId}`);

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

    // Forward the Session update to EMSP
    await this.forwardToEmsps(
      "PUT",
      `sessions/${countryCode}/${partyId}/${sessionId}`,
      payload,
    );

    return this.wrapResponse(null, 1000, "Session successfully updated");
  }

  // Handle incoming POST CDR from CPO
  async handlePostCdr(party: PartyContext, payload: any) {
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

    // Forward the CDR record to EMSP
    await this.forwardToEmsps("POST", "cdrs", payload);

    return this.wrapResponse(null, 1000, "CDR successfully created");
  }

  // Handle incoming start session command from EMSP
  async handleStartSession(party: PartyContext, payload: any) {
    this.logger.log(
      `[Tenant: ${party.id}] Received START_SESSION Command from EMSP: ${JSON.stringify(payload, null, 2)}`,
    );

    this.commands$.next({ type: "START_SESSION", data: payload });

    return this.wrapResponse(
      {
        status: "ACCEPTED",
      },
      1000,
      "Start session request accepted",
    );
  }

  // Handle incoming stop session command from EMSP
  async handleStopSession(party: PartyContext, payload: any) {
    this.logger.log(
      `[Tenant: ${party.id}] Received STOP_SESSION Command from EMSP: ${JSON.stringify(payload, null, 2)}`,
    );

    this.commands$.next({ type: "STOP_SESSION", data: payload });

    return this.wrapResponse(
      {
        status: "ACCEPTED",
      },
      1000,
      "Stop session request accepted",
    );
  }
}
