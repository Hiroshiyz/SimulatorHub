import {
  Controller,
  Post,
  Put,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  Sse,
  MessageEvent,
} from "@nestjs/common";
import { SimulatorService } from "./simulator.service";
import { Observable } from "rxjs";

@Controller("simulator")
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
    return this.simulatorService.sendTariff(
      countryCode,
      partyId,
      tariffId,
      body,
    );
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
    return this.simulatorService.sendSession(
      countryCode,
      partyId,
      sessionId,
      body,
    );
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

  @Get("locations")
  async getLocations() {
    return this.simulatorService.getLocations();
  }

  @Get("sessions")
  async getSessions() {
    return this.simulatorService.getSessions();
  }

  @Get("cdrs")
  async getCdrs() {
    return this.simulatorService.getCdrs();
  }

  // emsp
  @Post("emsps")
  async registerEmsp(
    @Body()
    body: {
      countryCode: string;
      partyId: string;
      name: string;
      url: string;
      tokenC: string;
    },
  ) {
    return this.simulatorService.registerEmsp(body);
  }

  @Get("emsps/status")
  async getEmspsStatus() {
    return this.simulatorService.getEmspStatus();
  }
  // cpo
  @Post("cpos")
  async registerCpo(
    @Body()
    body: {
      countryCode: string;
      partyId: string;
      name: string;
      tokenB: string;
    },
  ) {
    return this.simulatorService.registerCpo(body);
  }
  @Get("cpos")
  async getCpos() {
    return this.simulatorService.getCpos();
  }

  // sync all locations
  @Post("locations/sync-all")
  async syncAllLocations() {
    return this.simulatorService.syncAllLocations();
  }

  // sync to specific EMSP
  @Post("locations/sync-specific/:countryCode/:partyId")
  async syncSpecificLocations(
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
  ) {
    return this.simulatorService.syncLocationsToSpecificEmsp(countryCode, partyId);
  }

  // health check
  @Get("health")
  healthCheck() {
    return { status: "OK" };
  }
  // sse
  @Sse("events")
  sendEvents(): Observable<MessageEvent> {
    return this.simulatorService.getEventStream();
  }








  // --- Mock EMSP Receiver (Bypass authentication for simulated CPO -> EMSP endpoints) ---

  @Get("mock-emsp/:partyId/ocpi/2.2.1/versions")
  mockEmspVersions(@Param("partyId") partyId: string) {
    return {
      status_code: 1000,
      status_message: "Success",
      data: [
        {
          version: "2.2.1",
          url: `http://localhost:3030/simulator/mock-emsp/${partyId}/ocpi/2.2.1`,
        },
      ],
    };
  }

  @Get("mock-emsp/:partyId/health")
  mockEmspHealth(@Param("partyId") partyId: string) {
    return { status: "OK", partyId };
  }

  @Get("mock-emsp/:partyId")
  mockEmspBase(@Param("partyId") partyId: string) {
    return { status: "OK", description: `Mock EMSP receiver for ${partyId}` };
  }

  @Put(
    "mock-emsp/:partyId/ocpi/2.2.1/locations/:countryCode/:partyId/:locationId",
  )
  mockPutLocation() {
    return { status_code: 1000, status_message: "Success" };
  }

  @Patch(
    "mock-emsp/:partyId/ocpi/2.2.1/locations/:countryCode/:partyId/:locationId/:evseUid",
  )
  mockPatchEvse() {
    return { status_code: 1000, status_message: "Success" };
  }

  @Put("mock-emsp/:partyId/ocpi/2.2.1/tariffs/:countryCode/:partyId/:tariffId")
  mockPutTariff() {
    return { status_code: 1000, status_message: "Success" };
  }

  @Put(
    "mock-emsp/:emspPartyId/ocpi/2.2.1/sessions/:countryCode/:partyId/:sessionId",
  )
  async mockPutSession(
    @Param("emspPartyId") emspPartyId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: any,
  ) {
    await this.simulatorService.saveEmspSession(emspPartyId, sessionId, body);
    return { status_code: 1000, status_message: "Success" };
  }

  @Post("mock-emsp/:emspPartyId/ocpi/2.2.1/cdrs")
  async mockPostCdr(
    @Param("emspPartyId") emspPartyId: string,
    @Body() body: any,
  ) {
    await this.simulatorService.saveEmspCdr(emspPartyId, body);
    return { status_code: 1000, status_message: "Success" };
  }

  // --- Routing Rules APIs ---

  @Get("routing-rules")
  async getRoutingRules() {
    return this.simulatorService.getRoutingRules();
  }

  @Post("routing-rules")
  async createOrUpdateRoutingRule(@Body() body: any) {
    return this.simulatorService.createOrUpdateRoutingRule(body);
  }

  @Patch("routing-rules/:id/status")
  async updateRoutingRuleStatus(
    @Param("id") id: string,
    @Body("channelStatus") channelStatus: string,
  ) {
    return this.simulatorService.updateRoutingRuleStatus(id, channelStatus);
  }

  @Patch("routing-rules/:id/filters")
  async updateRoutingRuleFilters(
    @Param("id") id: string,
    @Body("routingFilters") routingFilters: any,
  ) {
    return this.simulatorService.updateRoutingRuleFilters(id, routingFilters);
  }

  @Delete("routing-rules/:id")
  async deleteRoutingRule(@Param("id") id: string) {
    return this.simulatorService.deleteRoutingRule(id);
  }
}
