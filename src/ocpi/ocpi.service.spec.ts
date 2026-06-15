import { Test, TestingModule } from "@nestjs/testing";
import { OcpiService } from "./ocpi.service";
import { PrismaService } from "../prisma/prisma.service";
import { PartyContext } from "../common/decorators/current-party.decorator";

describe("OcpiService", () => {
  let service: OcpiService;

  const mockPrismaService = {
    party: { findMany: jest.fn().mockResolvedValue([]) },
    location: { upsert: jest.fn() },
    evse: { upsert: jest.fn() },
    session: { upsert: jest.fn() },
    cdr: { upsert: jest.fn() },
  };

  const mockParty: PartyContext = {
    id: "tenant-123",
    countryCode: "TW",
    partyId: "NPT",
    role: "CPO",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcpiService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OcpiService>(OcpiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  describe("handlePutLocation", () => {
    it("should upsert location in prisma", async () => {
      const payload = { name: "Station 1", address: "Main St", city: "NPT", country: "TW", evses: [{ uid: "evse-1", status: "AVAILABLE" }] };
      await service.handlePutLocation(mockParty, "TW", "NPT", "loc-1", payload);

      expect(mockPrismaService.location.upsert).toHaveBeenCalled();
      expect(mockPrismaService.evse.upsert).toHaveBeenCalled();
    });
  });

  describe("handlePatchEvse", () => {
    it("should upsert EVSE status in prisma", async () => {
      const payload = { status: "CHARGING" };
      await service.handlePatchEvse(mockParty, "TW", "NPT", "loc-1", "evse-1", payload);

      expect(mockPrismaService.evse.upsert).toHaveBeenCalled();
    });
  });

  describe("handlePutSession", () => {
    it("should upsert session in prisma", async () => {
      const payload = { status: "ACTIVE", kwh: 12.3 };
      await service.handlePutSession(mockParty, "TW", "NPT", "sess-1", payload);

      expect(mockPrismaService.session.upsert).toHaveBeenCalled();
    });
  });

  describe("handlePostCdr", () => {
    it("should upsert cdr in prisma", async () => {
      const payload = { id: "cdr-1" };
      await service.handlePostCdr(mockParty, payload);

      expect(mockPrismaService.cdr.upsert).toHaveBeenCalled();
    });
  });

  describe("handleStartSession", () => {
    it("should return ACCEPTED response", async () => {
      const payload = { location_id: "loc_1" };
      const response = await service.handleStartSession(mockParty, payload);

      expect(response.status_code).toBe(1000);
      expect(response.data).toEqual({ status: "ACCEPTED" });
      expect(response.status_message).toBe("Start session request accepted");
    });
  });

  describe("handleStopSession", () => {
    it("should return ACCEPTED response", async () => {
      const payload = { session_id: "sess_1" };
      const response = await service.handleStopSession(mockParty, payload);

      expect(response.status_code).toBe(1000);
      expect(response.data).toEqual({ status: "ACCEPTED" });
      expect(response.status_message).toBe("Stop session request accepted");
    });
  });
});
