import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  UseGuards,
} from "@nestjs/common";
import { OcpiService } from "./ocpi.service";
import { ApiKeyGuard } from "../common/gurads/api-key.guard";

@UseGuards(ApiKeyGuard)
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
}
