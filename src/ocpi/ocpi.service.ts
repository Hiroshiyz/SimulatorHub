import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OcpiService {
  // Configuration for target CPO server (your main backend-dashboard server)
  private cpoBaseUrl = process.env.CPO_BASE_URL || 'http://localhost:3000';
  private tokenB = process.env.CREDENTIALS_TOKEN_B || 'mock_token_b_12345';
  private countryCode = 'TW';
  private partyId = 'NPT';

  // Helper to generate headers
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.tokenB}`,
      'Content-Type': 'application/json; charset=utf-8',
      'OCPI-to-party-id': this.partyId,
      'OCPI-to-country-code': this.countryCode,
      'OCPI-from-party-id': 'HUB',
      'OCPI-from-country-code': 'TW',
    };
  }

  // Response wrapper according to OCPI specification
  wrapResponse(data: any, statusCode = 1000, message = 'Success') {
    return {
      data,
      status_code: statusCode,
      status_message: message,
      timeStamp: new Date().toISOString(),
    };
  }

  // Handle incoming start session command from CPO
  async handleStartSession(payload: any) {
    console.log('Received START_SESSION Command from CPO:', JSON.stringify(payload, null, 2));
    
    // Simulate async response to CPO if needed, or simply return success response
    return this.wrapResponse({
      status: 'ACCEPTED'
    }, 1000, 'Start session request accepted');
  }

  // Handle incoming stop session command from CPO
  async handleStopSession(payload: any) {
    console.log('Received STOP_SESSION Command from CPO:', JSON.stringify(payload, null, 2));
    return this.wrapResponse({
      status: 'ACCEPTED'
    }, 1000, 'Stop session request accepted');
  }

  // --- SIMULATION METHODS (Triggering calls to our main CPO Receiver APIs) ---

  async sendLocation(countryCode: string, partyId: string, locationId: string, payload: any) {
    const url = `${this.cpoBaseUrl}/ocpi/2.2.1/locations/${countryCode}/${partyId}/${locationId}`;
    try {
      console.log(`Sending PUT Location to: ${url}`);
      const res = await axios.put(url, payload, { headers: this.getHeaders() });
      return res.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || `Failed to send Location: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendTariff(countryCode: string, partyId: string, tariffId: string, payload: any) {
    const url = `${this.cpoBaseUrl}/ocpi/2.2.1/tariffs/${countryCode}/${partyId}/${tariffId}`;
    try {
      console.log(`Sending PUT Tariff to: ${url}`);
      const res = await axios.put(url, payload, { headers: this.getHeaders() });
      return res.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || `Failed to send Tariff: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendEvseStatus(countryCode: string, partyId: string, locationId: string, evseUid: string, payload: any) {
    const url = `${this.cpoBaseUrl}/ocpi/2.2.1/locations/${countryCode}/${partyId}/${locationId}/${evseUid}`;
    try {
      console.log(`Sending PATCH EVSE Status to: ${url}`);
      const res = await axios.patch(url, payload, { headers: this.getHeaders() });
      return res.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || `Failed to update EVSE Status: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendSession(countryCode: string, partyId: string, sessionId: string, payload: any) {
    const url = `${this.cpoBaseUrl}/ocpi/2.2.1/sessions/${countryCode}/${partyId}/${sessionId}`;
    try {
      console.log(`Sending PUT Session to: ${url}`);
      const res = await axios.put(url, payload, { headers: this.getHeaders() });
      return res.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || `Failed to send Session: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendCdr(payload: any) {
    const url = `${this.cpoBaseUrl}/ocpi/2.2.1/cdrs`;
    try {
      console.log(`Sending POST CDR to: ${url}`);
      const res = await axios.post(url, payload, { headers: this.getHeaders() });
      return res.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || `Failed to send CDR: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendCancelSession(countryCode: string, partyId: string, transactionNo: string) {
    const url = `${this.cpoBaseUrl}/ocpi/2.2.1/sessions/${countryCode}/${partyId}/${transactionNo}`;
    try {
      console.log(`Sending POST Cancel Session to: ${url}`);
      const res = await axios.post(url, {}, { headers: this.getHeaders() });
      return res.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || `Failed to cancel Session: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
