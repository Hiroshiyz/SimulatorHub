import { Test, TestingModule } from "@nestjs/testing";
import { OcpiController } from "./ocpi.controller";
import { OcpiService } from "./ocpi.service";
import { ApiKeyGuard } from "../common/gurads/api-key.guard";
import { ExecutionContext } from "@nestjs/common";

describe("OcpiController", () => {
  let controller: OcpiController;
  let service: OcpiService;

  const mockOcpiService = {
    wrapResponse: jest.fn((data, statusCode = 1000, message = "Success") => ({
      data,
      status_code: statusCode,
      status_message: message,
      timeStamp: new Date().toISOString(),
    })),
    handleStartSession: jest.fn().mockResolvedValue({
      status_code: 1000,
      data: { status: "ACCEPTED" },
      status_message: "Success",
    }),
    handleStopSession: jest.fn().mockResolvedValue({
      status_code: 1000,
      data: { status: "ACCEPTED" },
      status_message: "Success",
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OcpiController],
      providers: [
        {
          provide: OcpiService,
          useValue: mockOcpiService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => true,
      })
      .compile();

    controller = module.get<OcpiController>(OcpiController);
    service = module.get<OcpiService>(OcpiService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getVersions", () => {
    it("should return version details", () => {
      const response = controller.getVersions();
      expect(service.wrapResponse).toHaveBeenCalled();
      expect(response.data).toEqual([
        {
          version: "2.2.1",
          url: "http://localhost:3030/ocpi/2.2.1",
        },
      ]);
    });
  });

  describe("getVersionDetails", () => {
    it("should return version endpoints", () => {
      const response = controller.getVersionDetails();
      expect(service.wrapResponse).toHaveBeenCalled();
      expect(response.data).toHaveProperty("version", "2.2.1");
      expect(response.data.endpoints[0]).toHaveProperty("identifier", "commands");
    });
  });

  describe("startSession", () => {
    it("should delegate to service.handleStartSession", async () => {
      const payload = { location_id: "loc_1" };
      const response = await controller.startSession(payload);
      expect(service.handleStartSession).toHaveBeenCalledWith(payload);
      expect(response.data).toEqual({ status: "ACCEPTED" });
    });
  });

  describe("stopSession", () => {
    it("should delegate to service.handleStopSession", async () => {
      const payload = { session_id: "sess_1" };
      const response = await controller.stopSession(payload);
      expect(service.handleStopSession).toHaveBeenCalledWith(payload);
      expect(response.data).toEqual({ status: "ACCEPTED" });
    });
  });
});
