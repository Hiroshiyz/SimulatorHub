import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EmspService {
  private readonly logger = new Logger(EmspService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Register EMSP Tenant
  async registerEmsp(data: {
    countryCode: string;
    partyId: string;
    name: string;
    url: string;
    tokenC: string;
  }) {
    this.logger.log(
      `Registering EMSP tenant: ${data.countryCode}/${data.partyId}`,
    );
    const party = await this.prisma.party.upsert({
      where: {
        countryCode_partyId_role: {
          countryCode: data.countryCode.toUpperCase(),
          partyId: data.partyId.toUpperCase(),
          role: "EMSP",
        },
      },
      update: {
        name: data.name,
      },
      create: {
        countryCode: data.countryCode.toUpperCase(),
        partyId: data.partyId.toUpperCase(),
        role: "EMSP",
        name: data.name,
        rateLimit: 100,
        rateLimitWindow: 60,
      },
    });

    await this.prisma.credential.upsert({
      where: { partyId: party.id },
      update: {
        url: data.url,
        tokenC: data.tokenC,
        tokenB: data.tokenC, // Sync Token B same as C for simplicity in mock hub
      },
      create: {
        partyId: party.id,
        url: data.url,
        tokenB: data.tokenC,
        tokenC: data.tokenC,
      },
    });

    return party;
  }

  // Get active status and health readings for all EMSP channels
  async getEmspStatus() {
    const emsps = await this.prisma.party.findMany({
      where: { role: "EMSP" },
      include: { credential: true },
    });

    const results = [];
    for (const emsp of emsps) {
      let isOnline = false;
      let latency = 0;
      let error = null;
      const url = emsp.credential?.url;

      if (url) {
        const startTime = Date.now();
        try {
          const checkUrl = url.includes("mock-emsp")
            ? `${url}/health`
            : `${url}/ocpi/2.2.1/versions`;
          await axios.get(checkUrl, {
            timeout: 1500,
            validateStatus: () => true,
          });
          isOnline = true;
          latency = Date.now() - startTime;
        } catch (err: any) {
          try {
            await axios.get(url, { timeout: 1500, validateStatus: () => true });
            isOnline = true;
            latency = Date.now() - startTime;
          } catch (err2: any) {
            error = err2.message;
            this.logger.warn(
              `EMSP ${emsp.partyId} health check failed: ${error} (${url})`,
            );
          }
        }
      }

      results.push({
        id: emsp.id,
        countryCode: emsp.countryCode,
        partyId: emsp.partyId,
        name: emsp.name || `${emsp.countryCode}-${emsp.partyId}`,
        url: url || null,
        online: isOnline,
        latency,
        error,
        tokenC: emsp.credential?.tokenC || null,
      });
    }

    return results;
  }

  // Forward data payload to EMSP endpoints (broadcast or specific EMSP)
  async forwardToEmsps(
    method: "POST" | "PUT" | "PATCH",
    subPath: string,
    payload: any,
    targetEmspId?: string,
    fromPartyId?: string,
    fromCountryCode?: string,
  ) {
    try {
      const whereClause: any = { role: "EMSP" };
      if (targetEmspId) {
        whereClause.id = targetEmspId;
      }

      const emspParties = await this.prisma.party.findMany({
        where: whereClause,
        include: { credential: true },
      });

      for (const emsp of emspParties) {
        if (emsp.credential && emsp.credential.url && emsp.credential.tokenB) {
          const url = `${emsp.credential.url}/ocpi/2.2.1/${subPath}`;
          const headers = {
            Authorization: `bearer ${emsp.credential.tokenB}`,
            "Content-Type": "application/json; charset=utf-8",
            "OCPI-to-party-id": emsp.partyId,
            "OCPI-to-country-code": emsp.countryCode,
            "OCPI-from-party-id": fromPartyId || "HUB",
            "OCPI-from-country-code": fromCountryCode || "TW",
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

  // Sync Locations to target EMSP(s)
  async syncLocationsToEmsp(
    countryCode?: string,
    partyId?: string,
    targetEmspId?: string,
  ) {
    this.logger.log(
      `Triggered locations synchronization to EMSP: ${targetEmspId || "ALL"}`,
    );
    try {
      let finalTargetId = targetEmspId;
      if (countryCode && partyId && !finalTargetId) {
        const targetParty = await this.prisma.party.findFirst({
          where: {
            countryCode: countryCode.toUpperCase(),
            partyId: partyId.toUpperCase(),
            role: "EMSP",
          },
        });
        if (targetParty) {
          finalTargetId = targetParty.id;
        }
      }

      const locations = await this.prisma.location.findMany({
        include: {
          party: true,
          evses: true,
        },
      });

      let count = 0;
      for (const loc of locations) {
        const party = loc.party; // CPO Party
        if (!party) continue;

        const cleanedEvses = loc.evses.map((e) => {
          const raw = e.rawJson as any;
          return {
            uid: e.uid,
            evse_id: e.id || raw?.evse_id || e.uid,
            status: e.status,
            capabilities: raw?.capabilities || ["REMOTE_START_STOP_ALLOWED"],
            connectors: raw?.connectors || [],
          };
        });

        const rawLoc = loc.rawJson as any;
        const payload = {
          ...rawLoc,
          evses: cleanedEvses,
        };

        const subPath = `locations/${party.countryCode}/${party.partyId}/${loc.id}`;
        await this.forwardToEmsps(
          "PUT",
          subPath,
          payload,
          finalTargetId,
          party.partyId,
          party.countryCode,
        );
        count++;
      }

      return { success: true, count };
    } catch (err: any) {
      this.logger.error(`Failed to sync locations: ${err.message}`);
      throw new Error(`Sync locations failed: ${err.message}`);
    }
  }
}
