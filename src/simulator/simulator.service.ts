import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
  }

  async getSessions() {
    return this.prisma.session.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async getCdrs() {
    return this.prisma.cdr.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });
  }
}
