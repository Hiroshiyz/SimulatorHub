import { Test, TestingModule } from "@nestjs/testing";
import { SimulatorService } from "./simulator.service";
import { PrismaService } from "../prisma/prisma.service";
import { OcpiService } from "../ocpi/ocpi.service";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("SimulatorService", () => {
  let service: SimulatorService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      party: {
        findFirst: jest.fn().mockResolvedValue(null), // returns null to fall back to environment variables in tests
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: "mock_party_id", ...create })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      credential: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulatorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: OcpiService,
          useValue: {
            commands$: {
              pipe: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SimulatorService>(SimulatorService);
    process.env.HUB_BASE_URL = "http://localhost:3030";
    process.env.CREDENTIALS_TOKEN_B = "mock_token_b_12345";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("sendLocation", () => {
    it("should send PUT request to Hub location endpoint", async () => {
      const payload = { id: "loc_1" };
      mockedAxios.put.mockResolvedValueOnce({ data: { status_code: 1000 } });

      const response = await service.sendLocation("TW", "NPT", "loc_1", payload);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:3030/ocpi/2.2.1/locations/TW/NPT/loc_1",
        payload,
        expect.any(Object),
      );
      expect(response).toEqual({ status_code: 1000 });
    });
  });

  describe("sendTariff", () => {
    it("should send PUT request to Hub tariff endpoint", async () => {
      const payload = { id: "tariff_1" };
      mockedAxios.put.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendTariff("TW", "NPT", "tariff_1", payload);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:3030/ocpi/2.2.1/tariffs/TW/NPT/tariff_1",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendEvseStatus", () => {
    it("should send PATCH request to Hub EVSE status endpoint", async () => {
      const payload = { status: "AVAILABLE" };
      mockedAxios.patch.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendEvseStatus("TW", "NPT", "loc_1", "evse_1", payload);

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        "http://localhost:3030/ocpi/2.2.1/locations/TW/NPT/loc_1/evse_1",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendSession", () => {
    it("should send PUT request to Hub session endpoint", async () => {
      const payload = { id: "sess_1" };
      mockedAxios.put.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendSession("TW", "NPT", "sess_1", payload);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:3030/ocpi/2.2.1/sessions/TW/NPT/sess_1",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendCdr", () => {
    it("should send POST request to Hub CDR endpoint", async () => {
      const payload = { id: "cdr_1" };
      mockedAxios.post.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendCdr(payload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:3030/ocpi/2.2.1/cdrs",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendCancelSession", () => {
    it("should send POST request to cancel Hub session", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendCancelSession("TW", "NPT", "txn_123");

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:3030/ocpi/2.2.1/sessions/TW/NPT/txn_123",
        {},
        expect.any(Object),
      );
    });
  });

  describe("registerCpo", () => {
    it("should register a CPO party and credential", async () => {
      const payload = {
        countryCode: "TW",
        partyId: "EVZ",
        name: "Test CPO",
        tokenB: "mock_token_b",
      };

      const result = await service.registerCpo(payload);

      expect(mockPrisma.party.upsert).toHaveBeenCalled();
      expect(mockPrisma.credential.upsert).toHaveBeenCalled();
      expect(result.partyId).toBe("EVZ");
    });
  });

  describe("registerEmsp", () => {
    it("should register an EMSP party and credential", async () => {
      const payload = {
        countryCode: "TW",
        partyId: "EVZ_EMSP",
        name: "Test EMSP",
        url: "http://localhost:5053",
        tokenC: "mock_token_c",
      };

      const result = await service.registerEmsp(payload);

      expect(mockPrisma.party.upsert).toHaveBeenCalled();
      expect(mockPrisma.credential.upsert).toHaveBeenCalled();
      expect(result.partyId).toBe("EVZ_EMSP");
    });
  });

  describe("getCpos", () => {
    it("should retrieve all CPO parties", async () => {
      mockPrisma.party.findMany.mockResolvedValueOnce([
        { id: "1", role: "CPO", name: "CPO 1" },
      ]);

      const result = await service.getCpos();

      expect(mockPrisma.party.findMany).toHaveBeenCalledWith({
        where: { role: "CPO" },
        include: { credential: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getEmspStatus", () => {
    it("should return correct status even if versions endpoint returns 401", async () => {
      mockPrisma.party.findMany.mockResolvedValueOnce([
        {
          id: "emsp-1",
          countryCode: "TW",
          partyId: "EMSP",
          role: "EMSP",
          credential: { url: "http://localhost:5053" },
        },
      ]);
      mockedAxios.get.mockResolvedValueOnce({ status: 401 }); // Mock versions endpoint returning 401

      const result = await service.getEmspStatus();

      expect(result[0].online).toBe(true);
      expect(result[0].error).toBeNull();
    });
  });
});
