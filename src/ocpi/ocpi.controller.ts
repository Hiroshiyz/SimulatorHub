import {
  Controller,
  Post,
  Put,
  Patch,
  Body,
  Param,
  HttpCode,
  Get,
} from "@nestjs/common";
import { OcpiService } from "./ocpi.service";

@Controller()
export class OcpiController {
  constructor(private readonly ocpiService: OcpiService) {}

  // --- Version Information ---
  @Get("ocpi/versions")
  getVersions() {
    return this.ocpiService.wrapResponse([
      {
        version: "2.2.1",
        url: "http://localhost:3030/ocpi/2.2.1",
      },
    ]);
  }

  @Get("ocpi/2.2.1")
  getVersionDetails() {
    return this.ocpiService.wrapResponse({
      version: "2.2.1",
      endpoints: [
        {
          identifier: "commands",
          role: "RECEIVER",
          url: "http://localhost:3030/ocpi/2.2.1/commands",
        },
      ],
    });
  }

  // --- OCPI Commands (Endpoints that receive requests from your main server) ---

  @Post("ocpi/2.2.1/commands/START_SESSION")
  @HttpCode(200)
  startSession(@Body() body: any) {
    return this.ocpiService.handleStartSession(body);
  }

  @Post("ocpi/2.2.1/commands/STOP_SESSION")
  @HttpCode(200)
  stopSession(@Body() body: any) {
    return this.ocpiService.handleStopSession(body);
  }

  // --- Simulation Triggers (Call these endpoints to push data mock requests to your main server) ---

  @Post("simulate/locations/:countryCode/:partyId/:locationId")
  async simulateSendLocation(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("locationId") locationId: string,
    @Body() body: any,
  ) {
    return this.ocpiService.sendLocation(
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
    return this.ocpiService.sendTariff(countryCode, partyId, tariffId, body);
  }

  @Post("simulate/locations/:countryCode/:partyId/:locationId/:evseUid")
  async simulateSendEvseStatus(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("locationId") locationId: string,
    @Param("evseUid") evseUid: string,
    @Body() body: any,
  ) {
    return this.ocpiService.sendEvseStatus(
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
    return this.ocpiService.sendSession(countryCode, partyId, sessionId, body);
  }

  @Post("simulate/cdrs")
  async simulateSendCdr(@Body() body: any) {
    return this.ocpiService.sendCdr(body);
  }

  @Post("simulate/sessions/cancel/:countryCode/:partyId/:transactionNo")
  async simulateSendCancelSession(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("transactionNo") transactionNo: string,
  ) {
    return this.ocpiService.sendCancelSession(
      countryCode,
      partyId,
      transactionNo,
    );
  }
}
