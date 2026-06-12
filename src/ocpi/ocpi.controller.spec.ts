import { Test, TestingModule } from "@nestjs/testing";
import { OcpiController } from "./ocpi.controller";
import { OcpiService } from "./ocpi.service";
import { ApiKeyGuard } from "../common/gurads/api-key.guard";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { PartyContext } from "../common/decorators/current-party.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

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
    handlePutLocation: jest.fn().mockResolvedValue({ status_code: 1000 }),
    handlePatchEvse: jest.fn().mockResolvedValue({ status_code: 1000 }),
    handlePutTariff: jest.fn().mockResolvedValue({ status_code: 1000 }),
    handlePutSession: jest.fn().mockResolvedValue({ status_code: 1000 }),
    handlePostCdr: jest.fn().mockResolvedValue({ status_code: 1000 }),
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

  const mockParty: PartyContext = {
    id: "tenant-123",
    countryCode: "TW",
    partyId: "NPT",
    role: "CPO",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OcpiController],
      providers: [
        {
          provide: OcpiService,
          useValue: mockOcpiService,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: {},
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getVersions", () => {
    it("should return version details", () => {
      controller.getVersions();
      expect(service.wrapResponse).toHaveBeenCalled();
    });
  });

  describe("getVersionDetails", () => {
    it("should return version endpoints", () => {
      controller.getVersionDetails();
      expect(service.wrapResponse).toHaveBeenCalled();
    });
  });

  describe("putLocation", () => {
    it("should allow matching tenant to put location", async () => {
      const payload = { name: "Station 1" };
      await controller.putLocation(mockParty, "TW", "NPT", "loc-1", payload);
      expect(service.handlePutLocation).toHaveBeenCalledWith(mockParty, "TW", "NPT", "loc-1", payload);
    });

    it("should block non-matching tenant with ForbiddenException", async () => {
      const payload = { name: "Station 1" };
      await expect(
        controller.putLocation(mockParty, "US", "TES", "loc-1", payload),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("patchEvse", () => {
    it("should allow matching tenant to patch evse", async () => {
      const payload = { status: "CHARGING" };
      await controller.patchEvse(mockParty, "TW", "NPT", "loc-1", "evse-1", payload);
      expect(service.handlePatchEvse).toHaveBeenCalledWith(mockParty, "TW", "NPT", "loc-1", "evse-1", payload);
    });
  });

  describe("putSession", () => {
    it("should allow matching tenant to put session", async () => {
      const payload = { id: "sess-1" };
      await controller.putSession(mockParty, "TW", "NPT", "sess-1", payload);
      expect(service.handlePutSession).toHaveBeenCalledWith(mockParty, "TW", "NPT", "sess-1", payload);
    });
  });

  describe("postCdr", () => {
    it("should allow matching tenant to post cdr", async () => {
      const payload = { id: "cdr-1", ctr_code: "TW", party_id: "NPT" };
      await controller.postCdr(mockParty, payload);
      expect(service.handlePostCdr).toHaveBeenCalledWith(mockParty, payload);
    });
  });

  describe("startSession", () => {
    it("should delegate to service.handleStartSession", async () => {
      const payload = { location_id: "loc_1" };
      const response = await controller.startSession(mockParty, payload);
      expect(service.handleStartSession).toHaveBeenCalledWith(mockParty, payload);
      expect(response.data).toEqual({ status: "ACCEPTED" });
    });
  });

  describe("stopSession", () => {
    it("should delegate to service.handleStopSession", async () => {
      const payload = { session_id: "sess_1" };
      const response = await controller.stopSession(mockParty, payload);
      expect(service.handleStopSession).toHaveBeenCalledWith(mockParty, payload);
      expect(response.data).toEqual({ status: "ACCEPTED" });
    });
  });
});
