import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);

  // Configuration for target CPO server (your main backend-dashboard server)
  private emspBaseUrl = process.env.EMSP_BASE_URL || "http://localhost:3000";
  private tokenB = process.env.CREDENTIALS_TOKEN_B || "mock_token_b_12345";
  private countryCode = "TW";
  private partyId = "NPT";

  // Helper to generate headers
  private getHeaders() {
    return {
      Authorization: `Bearer ${this.tokenB}`,
      "Content-Type": "application/json; charset=utf-8",
      "OCPI-to-party-id": this.partyId,
      "OCPI-to-country-code": this.countryCode,
      "OCPI-from-party-id": "HUB",
      "OCPI-from-country-code": "TW",
    };
  }

  // --- SIMULATION METHODS (Triggering calls to our main CPO Receiver APIs) ---

  async sendLocation(
    countryCode: string,
    partyId: string,
    locationId: string,
    payload: any,
  ) {
    const url = `${this.emspBaseUrl}/ocpi/2.2.1/locations/${countryCode}/${partyId}/${locationId}`;
    try {
      this.logger.log(`Sending PUT Location to: ${url}`);
      const res = await axios.put(url, payload, { headers: this.getHeaders() });
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
    const url = `${this.emspBaseUrl}/ocpi/2.2.1/tariffs/${countryCode}/${partyId}/${tariffId}`;
    try {
      this.logger.log(`Sending PUT Tariff to: ${url}`);
      const res = await axios.put(url, payload, { headers: this.getHeaders() });
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
    const url = `${this.emspBaseUrl}/ocpi/2.2.1/locations/${countryCode}/${partyId}/${locationId}/${evseUid}`;
    try {
      this.logger.log(`Sending PATCH EVSE Status to: ${url}`);
      const res = await axios.patch(url, payload, {
        headers: this.getHeaders(),
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
    const url = `${this.emspBaseUrl}/ocpi/2.2.1/sessions/${countryCode}/${partyId}/${sessionId}`;
    try {
      this.logger.log(`Sending PUT Session to: ${url}`);
      const res = await axios.put(url, payload, { headers: this.getHeaders() });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to send Session: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendCdr(payload: any) {
    const url = `${this.emspBaseUrl}/ocpi/2.2.1/cdrs`;
    try {
      this.logger.log(`Sending POST CDR to: ${url}`);
      const res = await axios.post(url, payload, {
        headers: this.getHeaders(),
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
    const url = `${this.emspBaseUrl}/ocpi/2.2.1/sessions/${countryCode}/${partyId}/${transactionNo}`;
    try {
      this.logger.log(`Sending POST Cancel Session to: ${url}`);
      const res = await axios.post(url, {}, { headers: this.getHeaders() });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || `Failed to cancel Session: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
