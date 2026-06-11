import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class OcpiService {
  private readonly logger = new Logger(OcpiService.name);

  // Response wrapper according to OCPI specification
  wrapResponse(data: any, statusCode = 1000, message = "Success") {
    return {
      data,
      status_code: statusCode,
      status_message: message,
      timeStamp: new Date().toISOString(),
    };
  }

  // Handle incoming start session command from emsp
  async handleStartSession(payload: any) {
    this.logger.log(
      `Received START_SESSION Command from EMSP: ${JSON.stringify(payload, null, 2)}`,
    );

    // Simulate async response to EMSP if needed, or simply return success response
    return this.wrapResponse(
      {
        status: "ACCEPTED",
      },
      1000,
      "Start session request accepted",
    );
  }

  // Handle incoming stop session command from EMSP
  async handleStopSession(payload: any) {
    this.logger.log(
      `Received STOP_SESSION Command from EMSP: ${JSON.stringify(payload, null, 2)}`,
    );
    return this.wrapResponse(
      {
        status: "ACCEPTED",
      },
      1000,
      "Stop session request accepted",
    );
  }
}
