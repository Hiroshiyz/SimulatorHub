import { Test, TestingModule } from "@nestjs/testing";
import { EmspService } from "./emsp.service";
import { PrismaService } from "../prisma/prisma.service";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("EmspService", () => {
  let service: EmspService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      party: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: "mock_emsp_id", ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      credential: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      location: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmspService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EmspService>(EmspService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("registerEmsp", () => {
    it("should register an EMSP and its credential in prisma", async () => {
      const payload = {
        countryCode: "TW",
        partyId: "SMB",
        name: "SmartHub",
        url: "http://localhost:5000",
        tokenC: "mock_token_c",
      };

      const result = await service.registerEmsp(payload);

      expect(mockPrisma.party.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            countryCode: "TW",
            partyId: "SMB",
            role: "EMSP",
          }),
        }),
      );
      expect(mockPrisma.credential.upsert).toHaveBeenCalled();
      expect(result.id).toBe("mock_emsp_id");
    });
  });

  describe("getEmspStatus", () => {
    it("should return empty list when no EMSPs are registered", async () => {
      const status = await service.getEmspStatus();
      expect(status).toEqual([]);
    });

    it("should perform health checks and return latency for registered EMSPs", async () => {
      mockPrisma.party.findMany.mockResolvedValueOnce([
        {
          id: "emsp-1",
          countryCode: "TW",
          partyId: "SMB",
          name: "SmartHub",
          credential: {
            url: "http://localhost:5000/mock-emsp/SMB",
            tokenC: "mock_token_c",
          },
        },
      ]);
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const status = await service.getEmspStatus();

      expect(status).toHaveLength(1);
      expect(status[0].online).toBe(true);
      expect(status[0].latency).toBeGreaterThanOrEqual(0);
      expect(status[0].error).toBeNull();
    });
  });

  describe("forwardToEmsps", () => {
    it("should send PUT request to registered EMSPs with correct headers", async () => {
      mockPrisma.party.findMany.mockResolvedValueOnce([
        {
          id: "emsp-1",
          countryCode: "TW",
          partyId: "SMB",
          credential: {
            url: "http://localhost:5000/mock-emsp/SMB",
            tokenB: "mock_token_b",
          },
        },
      ]);
      mockedAxios.put.mockResolvedValueOnce({ status: 200 });

      const payload = { test: "data" };
      await service.forwardToEmsps("PUT", "locations/TW/CPO/123", payload, undefined, "CPO", "TW");

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:5000/mock-emsp/SMB/ocpi/2.2.1/locations/TW/CPO/123",
        payload,
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "bearer mock_token_b",
            "OCPI-from-party-id": "CPO",
            "OCPI-from-country-code": "TW",
          }),
        }),
      );
    });
  });

  describe("syncLocationsToEmsp", () => {
    it("should fetch locations and forward them as PUT requests", async () => {
      mockPrisma.party.findFirst.mockResolvedValueOnce({
        id: "emsp-1",
        countryCode: "TW",
        partyId: "SMB",
      });

      mockPrisma.location.findMany.mockResolvedValueOnce([
        {
          id: "loc-123",
          rawJson: { name: "Station 1", address: "Main St", city: "Taipei", country: "TWN" },
          party: { countryCode: "TW", partyId: "CPO" },
          evses: [],
        },
      ]);

      const forwardSpy = jest.spyOn(service, "forwardToEmsps").mockResolvedValueOnce(undefined);

      const result = await service.syncLocationsToEmsp("TW", "SMB");

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(forwardSpy).toHaveBeenCalledWith(
        "PUT",
        "locations/TW/CPO/loc-123",
        expect.objectContaining({ name: "Station 1" }),
        "emsp-1",
        "CPO",
        "TW",
      );
    });

    it("should preserve custom EVSE parameters from rawJson when syncing", async () => {
      mockPrisma.party.findFirst.mockResolvedValueOnce({
        id: "emsp-1",
        countryCode: "TW",
        partyId: "SMB",
      });

      mockPrisma.location.findMany.mockResolvedValueOnce([
        {
          id: "loc-123",
          name: "Station 1",
          address: "Main St",
          city: "Taipei",
          postalCode: "100",
          country: "TWN",
          coordinates: { latitude: "25.0", longitude: "121.0" },
          rawJson: { name: "Station 1", parking_type: "ON_STREET" },
          party: { countryCode: "TW", partyId: "CPO" },
          evses: [
            {
              uid: "EVSE-1",
              id: "E1",
              status: "AVAILABLE",
              rawJson: {
                floor_level: "-1",
                connectors: [{ id: "1", standard: "CCS_2" }],
                physical_reference: "Bay 3",
              },
            },
          ],
        },
      ]);

      const forwardSpy = jest.spyOn(service, "forwardToEmsps").mockResolvedValueOnce(undefined);

      const result = await service.syncLocationsToEmsp("TW", "SMB");

      expect(result.success).toBe(true);
      expect(forwardSpy).toHaveBeenCalledWith(
        "PUT",
        "locations/TW/CPO/loc-123",
        expect.objectContaining({
          parking_type: "ON_STREET",
          evses: [
            expect.objectContaining({
              uid: "EVSE-1",
              evse_id: "E1",
              status: "AVAILABLE",
              floor_level: "-1",
              physical_reference: "Bay 3",
              connectors: [{ id: "1", standard: "CCS_2" }],
            }),
          ],
        }),
        "emsp-1",
        "CPO",
        "TW",
      );
    });
  });
});
