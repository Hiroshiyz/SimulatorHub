import { Test, TestingModule } from "@nestjs/testing";
import { OcpiService } from "./ocpi.service";
import { PrismaService } from "../prisma/prisma.service";
import { PartyContext } from "../common/decorators/current-party.decorator";
import { EmspService } from "../emsp/emsp.service";
import { RoutingProducerService } from "./routing/routing-producer.service";


describe("OcpiService", () => {
  let service: OcpiService;

  const mockPrismaService = {
    party: { findMany: jest.fn().mockResolvedValue([]) },
    location: { upsert: jest.fn() },
    evse: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    session: {
      upsert: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cdr: { upsert: jest.fn() },
    credential: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const mockEmspService = {
    forwardToEmsps: jest.fn().mockResolvedValue(undefined),
    syncLocationsToEmsp: jest.fn().mockResolvedValue({ success: true, count: 0 }),
    registerEmsp: jest.fn().mockResolvedValue({}),
    getEmspStatus: jest.fn().mockResolvedValue([]),
  };

  const mockRoutingProducerService = {
    enqueueForwardTask: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: EmspService,
          useValue: mockEmspService,
        },
        {
          provide: RoutingProducerService,
          useValue: mockRoutingProducerService,
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
    it("should upsert EVSE status in prisma and merge rawJson", async () => {
      mockPrismaService.evse.findUnique.mockResolvedValueOnce({
        rawJson: { connectors: [{ id: "1" }], capabilities: ["REMOTE_START_STOP_ALLOWED"] },
        status: "AVAILABLE",
      });
      const payload = { status: "CHARGING" };
      await service.handlePatchEvse(mockParty, "TW", "NPT", "loc-1", "evse-1", payload);

      expect(mockPrismaService.evse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: "CHARGING",
            rawJson: {
              connectors: [{ id: "1" }],
              capabilities: ["REMOTE_START_STOP_ALLOWED"],
              status: "CHARGING",
            },
          }),
        }),
      );
    });
  });

  describe("handlePutSession", () => {
    it("should upsert session in prisma", async () => {
      const payload = { status: "ACTIVE", kwh: 12.3 };
      await service.handlePutSession(mockParty, "TW", "NPT", "sess-1", payload);

      expect(mockPrismaService.session.upsert).toHaveBeenCalled();
    });

    it("should not reopen a session that is already COMPLETED", async () => {
      mockPrismaService.session.findUnique.mockResolvedValueOnce({ status: "COMPLETED" });
      const payload = { status: "ACTIVE", kwh: 12.3 };
      await service.handlePutSession(mockParty, "TW", "NPT", "sess-1", payload);

      expect(mockPrismaService.session.upsert).not.toHaveBeenCalled();
      expect(mockRoutingProducerService.enqueueForwardTask).not.toHaveBeenCalled();
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
      expect(response.data).toEqual({ result: "ACCEPTED", timeout: 30 });
      expect(response.status_message).toBe("Start session request accepted");
    });
  });

  describe("handleStopSession", () => {
    const emspParty: PartyContext = {
      id: "emsp-1",
      countryCode: "TW",
      partyId: "EMP",
      role: "EMSP",
    };
    const activeSession = {
      partyId: "tenant-123",
      id: "sess_1",
      locationId: "loc_1",
      evseUid: "evse-1",
      status: "ACTIVE",
      kwh: 12.5,
      createdAt: new Date("2026-09-29T00:00:00Z"),
      rawJson: {
        emsp_id: "emsp-1",
        start_date_time: "2026-09-29T00:00:00Z",
        total_cost: { excl_vat: 100, incl_vat: 105 },
      },
      party: mockParty,
    };

    const flushSettlement = () => new Promise((resolve) => setImmediate(resolve));

    it("should reject a missing session_id", async () => {
      const response = await service.handleStopSession(emspParty, {});
      expect(response.status_code).toBe(2001);
    });

    it("should answer UNKNOWN_SESSION when no ACTIVE session matches", async () => {
      const response = await service.handleStopSession(emspParty, { session_id: "sess_1" });

      expect(response.data).toEqual({ result: "UNKNOWN_SESSION", timeout: 30 });
      expect(mockPrismaService.session.updateMany).not.toHaveBeenCalled();
    });

    it("should answer UNKNOWN_SESSION when the session belongs to another EMSP", async () => {
      mockPrismaService.session.findFirst.mockResolvedValueOnce({
        ...activeSession,
        rawJson: { ...activeSession.rawJson, emsp_id: "other-emsp" },
      });
      const response = await service.handleStopSession(emspParty, { session_id: "sess_1" });

      expect(response.data).toEqual({ result: "UNKNOWN_SESSION", timeout: 30 });
      expect(mockPrismaService.session.updateMany).not.toHaveBeenCalled();
    });

    it("should complete the session, issue a CDR and notify the UI", async () => {
      mockPrismaService.session.findFirst.mockResolvedValueOnce(activeSession);
      const events: any[] = [];
      const sub = service.commands$.subscribe((e) => events.push(e));

      const response = await service.handleStopSession(emspParty, { session_id: "sess_1" });
      await flushSettlement();
      await flushSettlement();
      sub.unsubscribe();

      expect(response.data).toEqual({ result: "ACCEPTED", timeout: 30 });
      expect(mockPrismaService.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { partyId: "tenant-123", id: "sess_1", status: "ACTIVE" },
          data: expect.objectContaining({ status: "COMPLETED" }),
        }),
      );
      expect(mockPrismaService.cdr.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            id: "CDR-sess_1",
            rawJson: expect.objectContaining({
              session_id: "sess_1",
              country_code: "TW",
              party_id: "NPT",
              total_energy: 12.5,
            }),
          }),
        }),
      );
      expect(mockRoutingProducerService.enqueueForwardTask).toHaveBeenCalledWith(
        "POST",
        "cdrs",
        expect.any(Object),
        "TW",
        "NPT",
        "TW",
        "EMP",
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "SESSION_STOPPED",
          data: expect.objectContaining({ session_id: "sess_1", result: "ACCEPTED" }),
        }),
      );
    });

    it("should reject a duplicate STOP while the session is already stopping", async () => {
      mockPrismaService.session.findFirst.mockResolvedValueOnce(activeSession);
      mockPrismaService.session.updateMany.mockResolvedValueOnce({ count: 0 });
      const response = await service.handleStopSession(emspParty, { session_id: "sess_1" });

      expect(response.data).toEqual({ result: "REJECTED", timeout: 30 });
      expect(mockPrismaService.cdr.upsert).not.toHaveBeenCalled();
    });
  });
});
