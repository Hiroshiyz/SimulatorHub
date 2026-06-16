import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  MessageEvent,
  OnModuleInit,
} from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma/prisma.service";
import { OcpiService } from "../ocpi/ocpi.service";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class SimulatorService implements OnModuleInit {
  private readonly logger = new Logger(SimulatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocpiService: OcpiService,
  ) {}

  // Helper to dynamically get headers & base URL for a given CPO party
  private async getTenantConfig(countryCode: string, partyId: string) {
    const targetBaseUrl = process.env.HUB_BASE_URL || "http://localhost:3030";
    let tokenB = process.env.CREDENTIALS_TOKEN_B || "mock_token_b_12345";

    try {
      // Find the CPO party in the database
      const party = await this.prisma.party.findFirst({
        where: {
          countryCode: countryCode.toUpperCase(),
          partyId: partyId.toUpperCase(),
          role: "CPO",
        },
        include: {
          credential: true,
        },
      });

      if (party && party.credential && party.credential.tokenB) {
        tokenB = party.credential.tokenB;
      }
    } catch (err) {
      this.logger.error(
        `Failed to fetch tenant configuration for ${countryCode}/${partyId}:`,
        err,
      );
    }

    return {
      baseUrl: targetBaseUrl,
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json; charset=utf-8",
        "OCPI-to-party-id": "HUB",
        "OCPI-to-country-code": "TW",
        "OCPI-from-party-id": partyId.toUpperCase(),
        "OCPI-from-country-code": countryCode.toUpperCase(),
      },
    };
  }

  // --- SIMULATION METHODS (Triggering calls to our CPO Receiver APIs) ---

  async sendLocation(
    countryCode: string,
    partyId: string,
    locationId: string,
    payload: any,
  ) {
    const config = await this.getTenantConfig(countryCode, partyId);
    const url = `${config.baseUrl}/ocpi/2.2.1/locations/${countryCode}/${partyId}/${locationId}`;
    try {
      this.logger.log(`Sending PUT Location to: ${url}`);
      const res = await axios.put(url, payload, { headers: config.headers });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to send Location: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendTariff(
    countryCode: string,
    partyId: string,
    tariffId: string,
    payload: any,
  ) {
    const config = await this.getTenantConfig(countryCode, partyId);
    const url = `${config.baseUrl}/ocpi/2.2.1/tariffs/${countryCode}/${partyId}/${tariffId}`;
    try {
      this.logger.log(`Sending PUT Tariff to: ${url}`);
      const res = await axios.put(url, payload, { headers: config.headers });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to send Tariff: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendEvseStatus(
    countryCode: string,
    partyId: string,
    locationId: string,
    evseUid: string,
    payload: any,
  ) {
    const config = await this.getTenantConfig(countryCode, partyId);
    const url = `${config.baseUrl}/ocpi/2.2.1/locations/${countryCode}/${partyId}/${locationId}/${evseUid}`;
    try {
      this.logger.log(`Sending PATCH EVSE Status to: ${url}`);
      const res = await axios.patch(url, payload, {
        headers: config.headers,
      });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data ||
          `Failed to update EVSE Status: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendSession(
    countryCode: string,
    partyId: string,
    sessionId: string,
    payload: any,
  ) {
    const config = await this.getTenantConfig(countryCode, partyId);
    const url = `${config.baseUrl}/ocpi/2.2.1/sessions/${countryCode}/${partyId}/${sessionId}`;
    try {
      this.logger.log(`Sending PUT Session to: ${url}`);
      const res = await axios.put(url, payload, { headers: config.headers });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to send Session: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendCdr(payload: any) {
    // For CDR, find the party based on the cdr payload if available
    const countryCode = payload.ctr_code || "TW";
    const partyId = payload.party_id || "NPT";
    const config = await this.getTenantConfig(countryCode, partyId);
    const url = `${config.baseUrl}/ocpi/2.2.1/cdrs`;
    try {
      this.logger.log(`Sending POST CDR to: ${url}`);
      const res = await axios.post(url, payload, {
        headers: config.headers,
      });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to send CDR: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendCancelSession(
    countryCode: string,
    partyId: string,
    transactionNo: string,
  ) {
    const config = await this.getTenantConfig(countryCode, partyId);
    const url = `${config.baseUrl}/ocpi/2.2.1/sessions/${countryCode}/${partyId}/${transactionNo}`;
    try {
      this.logger.log(`Sending POST Cancel Session to: ${url}`);
      const res = await axios.post(url, {}, { headers: config.headers });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to cancel Session: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getLocations() {
    return this.prisma.location.findMany({
      include: {
        evses: true,
        party: true,
      },
    });
  }

  async getSessions() {
    return this.prisma.session.findMany({
      include: {
        party: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async syncAllLocations() {
    return this.ocpiService.syncAllLocations();
  }

  async getCdrs() {
    return this.prisma.cdr.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async getCpos() {
    return this.prisma.party.findMany({
      where: { role: "CPO" },
      include: { credential: true },
    });
  }

  getEventStream(): Observable<MessageEvent> {
    return this.ocpiService.commands$.pipe(
      map((event) => ({ data: event }) as MessageEvent),
    );
  }

  async onModuleInit() {
    this.logger.log("Verifying and upserting EMSP channels in database...");
    const defaultEmsps = [
      {
        countryCode: "TW",
        partyId: "SMB",
        name: "SMARTHUBLCU",
        url: "http://localhost:3030/simulator/mock-emsp/EVA",
      },
    ];

    for (const emsp of defaultEmsps) {
      try {
        const party = await this.prisma.party.upsert({
          where: {
            countryCode_partyId_role: {
              countryCode: emsp.countryCode,
              partyId: emsp.partyId,
              role: "EMSP",
            },
          },
          update: {
            name: emsp.name,
          },
          create: {
            countryCode: emsp.countryCode,
            partyId: emsp.partyId,
            role: "EMSP",
            name: emsp.name,
          },
        });

        await this.prisma.credential.upsert({
          where: { partyId: party.id },
          update: {
            url: emsp.url,
          },
          create: {
            partyId: party.id,
            url: emsp.url,
            tokenB: `mock_${emsp.partyId.toLowerCase()}_token_b_123`,
            tokenC: `mock_${emsp.partyId.toLowerCase()}_token_c_123`,
          },
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to upsert default EMSP ${emsp.partyId}: ${err.message}`,
        );
      }
    }
  }

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
      });
    }

    return results;
  }

  async registerCpo(data: {
    countryCode: string;
    partyId: string;
    name: string;
    tokenB: string;
  }) {
    this.logger.log(
      `Registering CPO tenant: ${data.countryCode}/${data.partyId}`,
    );
    const party = await this.prisma.party.upsert({
      where: {
        countryCode_partyId_role: {
          countryCode: data.countryCode.toUpperCase(),
          partyId: data.partyId.toUpperCase(),
          role: "CPO",
        },
      },
      update: {
        name: data.name,
      },
      create: {
        countryCode: data.countryCode.toUpperCase(),
        partyId: data.partyId.toUpperCase(),
        role: "CPO",
        name: data.name,
        rateLimit: 100,
        rateLimitWindow: 60,
      },
    });

    await this.prisma.credential.upsert({
      where: { partyId: party.id },
      update: {
        tokenB: data.tokenB,
        tokenC: data.tokenB,
      },
      create: {
        partyId: party.id,
        tokenB: data.tokenB,
        tokenC: data.tokenB,
      },
    });

    return party;
  }

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
        tokenB: data.tokenC,
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

  async saveEmspSession(emspPartyId: string, sessionId: string, payload: any) {
    const party = await this.prisma.party.findFirst({
      where: {
        partyId: emspPartyId.toUpperCase(),
        role: "EMSP",
      },
    });
    if (!party) {
      this.logger.warn(`EMSP party not found: ${emspPartyId}`);
      return;
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
  }

  async saveEmspCdr(emspPartyId: string, payload: any) {
    const cdrId = payload.id;
    if (!cdrId) return;

    const party = await this.prisma.party.findFirst({
      where: {
        partyId: emspPartyId.toUpperCase(),
        role: "EMSP",
      },
    });
    if (!party) {
      this.logger.warn(`EMSP party not found: ${emspPartyId}`);
      return;
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
  }
}
