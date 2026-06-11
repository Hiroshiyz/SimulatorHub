import { Test, TestingModule } from "@nestjs/testing";
import { OcpiService } from "./ocpi.service";

describe("OcpiService", () => {
  let service: OcpiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OcpiService],
    }).compile();

    service = module.get<OcpiService>(OcpiService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("wrapResponse", () => {
    it("should return the standard OCPI envelope structure", () => {
      const data = { token: "123" };
      const response = service.wrapResponse(data, 1000, "Success");

      expect(response).toHaveProperty("data", data);
      expect(response).toHaveProperty("status_code", 1000);
      expect(response).toHaveProperty("status_message", "Success");
      expect(response).toHaveProperty("timeStamp");
      expect(typeof response.timeStamp).toBe("string");
    });
  });

  describe("handleStartSession", () => {
    it("should return ACCEPTED response", async () => {
      const payload = { location_id: "loc_1" };
      const response = await service.handleStartSession(payload);

      expect(response.status_code).toBe(1000);
      expect(response.data).toEqual({ status: "ACCEPTED" });
      expect(response.status_message).toBe("Start session request accepted");
    });
  });

  describe("handleStopSession", () => {
    it("should return ACCEPTED response", async () => {
      const payload = { session_id: "sess_1" };
      const response = await service.handleStopSession(payload);

      expect(response.status_code).toBe(1000);
      expect(response.data).toEqual({ status: "ACCEPTED" });
      expect(response.status_message).toBe("Stop session request accepted");
    });
  });
});
