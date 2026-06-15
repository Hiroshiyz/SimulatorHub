import {
  Controller,
  Post,
  Put,
  Patch,
  Body,
  Param,
  HttpCode,
  Get,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { OcpiService } from "./ocpi.service";
import { ApiKeyGuard } from "../common/gurads/api-key.guard";
import { CurrentParty, PartyContext } from "../common/decorators/current-party.decorator";

@UseGuards(ApiKeyGuard)
@Controller()
export class OcpiController {
  constructor(private readonly ocpiService: OcpiService) {}

  // Helper to validate that the caller's identity matches the request path
  private validatePartyMatch(party: PartyContext, countryCode: string, partyId: string) {
    if (party.countryCode.toUpperCase() !== countryCode.toUpperCase() || 
        party.partyId.toUpperCase() !== partyId.toUpperCase()) {
      throw new ForbiddenException("Multi-tenant violation: You cannot access or modify resources of another tenant");
    }
  }

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
        {
          identifier: "locations",
          role: "RECEIVER",
          url: "http://localhost:3030/ocpi/2.2.1/locations",
        },
        {
          identifier: "sessions",
          role: "RECEIVER",
          url: "http://localhost:3030/ocpi/2.2.1/sessions",
        },
        {
          identifier: "tariffs",
          role: "RECEIVER",
          url: "http://localhost:3030/ocpi/2.2.1/tariffs",
        },
        {
          identifier: "cdrs",
          role: "RECEIVER",
          url: "http://localhost:3030/ocpi/2.2.1/cdrs",
        },
      ],
    });
  }

  // --- OCPI Locations Receiver ---
  @Put("ocpi/2.2.1/locations/:countryCode/:partyId/:locationId")
  @HttpCode(200)
  async putLocation(
    @CurrentParty() party: PartyContext,
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("locationId") locationId: string,
    @Body() body: any,
  ) {
    this.validatePartyMatch(party, countryCode, partyId);
    return this.ocpiService.handlePutLocation(party, countryCode, partyId, locationId, body);
  }

  // --- OCPI EVSE PATCH Receiver ---
  @Patch("ocpi/2.2.1/locations/:countryCode/:partyId/:locationId/:evseUid")
  @HttpCode(200)
  async patchEvse(
    @CurrentParty() party: PartyContext,
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("locationId") locationId: string,
    @Param("evseUid") evseUid: string,
    @Body() body: any,
  ) {
    this.validatePartyMatch(party, countryCode, partyId);
    return this.ocpiService.handlePatchEvse(party, countryCode, partyId, locationId, evseUid, body);
  }

  // --- OCPI Tariffs Receiver ---
  @Put("ocpi/2.2.1/tariffs/:countryCode/:partyId/:tariffId")
  @HttpCode(200)
  async putTariff(
    @CurrentParty() party: PartyContext,
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("tariffId") tariffId: string,
    @Body() body: any,
  ) {
    this.validatePartyMatch(party, countryCode, partyId);
    return this.ocpiService.handlePutTariff(party, countryCode, partyId, tariffId, body);
  }

  // --- OCPI Sessions Receiver ---
  @Put("ocpi/2.2.1/sessions/:countryCode/:partyId/:sessionId")
  @HttpCode(200)
  async putSession(
    @CurrentParty() party: PartyContext,
    @Param("countryCode") countryCode: string,
    @Param("partyId") partyId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: any,
  ) {
    this.validatePartyMatch(party, countryCode, partyId);
    return this.ocpiService.handlePutSession(party, countryCode, partyId, sessionId, body);
  }

  // --- OCPI CDRs Receiver ---
  @Post("ocpi/2.2.1/cdrs")
  @HttpCode(200)
  async postCdr(
    @CurrentParty() party: PartyContext,
    @Body() body: any,
  ) {
    // For CDRs, the party sending must still match the CDR's CPO country_code / party_id if specified in the payload
    if (body.ctr_code && body.party_id) {
      this.validatePartyMatch(party, body.ctr_code, body.party_id);
    }
    return this.ocpiService.handlePostCdr(party, body);
  }

  // --- OCPI Commands (Endpoints that receive requests from your EMSP) ---
  @Post("ocpi/2.2.1/commands/START_SESSION")
  @HttpCode(200)
  startSession(
    @CurrentParty() party: PartyContext,
    @Body() body: any,
  ) {
    return this.ocpiService.handleStartSession(party, body);
  }

  @Post("ocpi/2.2.1/commands/STOP_SESSION")
  @HttpCode(200)
  stopSession(
    @CurrentParty() party: PartyContext,
    @Body() body: any,
  ) {
    return this.ocpiService.handleStopSession(party, body);
  }
}
