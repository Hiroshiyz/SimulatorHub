import {
  Controller,
  Post,
  Body,
  Param,
} from "@nestjs/common";
import { SimulatorService } from "./simulator.service";

@Controller()
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  // --- Simulation Triggers (Call these endpoints to push data mock requests to your main server) ---

  @Post("simulate/locations/:countryCode/:partyId/:locationId")
  async simulateSendLocation(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("locationId") locationId: string,
    @Body() body: any,
  ) {
    return this.simulatorService.sendLocation(
      countryCode,
      partyId,
      locationId,
      body,
    );
  }

  @Post("simulate/tariffs/:countryCode/:partyId/:tariffId")
  async simulateSendTariff(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("tariffId") tariffId: string,
    @Body() body: any,
  ) {
    return this.simulatorService.sendTariff(countryCode, partyId, tariffId, body);
  }

  @Post("simulate/locations/:countryCode/:partyId/:locationId/:evseUid")
  async simulateSendEvseStatus(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("locationId") locationId: string,
    @Param("evseUid") evseUid: string,
    @Body() body: any,
  ) {
    return this.simulatorService.sendEvseStatus(
      countryCode,
      partyId,
      locationId,
      evseUid,
      body,
    );
  }

  @Post("simulate/sessions/:countryCode/:partyId/:sessionId")
  async simulateSendSession(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: any,
  ) {
    return this.simulatorService.sendSession(countryCode, partyId, sessionId, body);
  }

  @Post("simulate/cdrs")
  async simulateSendCdr(@Body() body: any) {
    return this.simulatorService.sendCdr(body);
  }

  @Post("simulate/sessions/cancel/:countryCode/:partyId/:transactionNo")
  async simulateSendCancelSession(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("transactionNo") transactionNo: string,
  ) {
    return this.simulatorService.sendCancelSession(
      countryCode,
      partyId,
      transactionNo,
    );
  }
}
