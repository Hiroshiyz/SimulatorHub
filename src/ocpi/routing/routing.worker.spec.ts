import { Test, TestingModule } from "@nestjs/testing";
import { OcpiRoutingWorker } from "./routing.worker";
import { HttpService } from "@nestjs/axios";
import { PrismaService } from "../../prisma/prisma.service";
import { RoutingCacheService } from "./routing-cache.service";
import { ConfigService } from "@nestjs/config";
import { encrypt } from "../../common/utils/crypto";
import { of } from "rxjs";
import axios from "axios";

jest.mock("axios");

describe("OcpiRoutingWorker", () => {
  let worker: OcpiRoutingWorker;
  let httpService: HttpService;
  let prismaService: PrismaService;
  let cacheService: RoutingCacheService;
  let configService: ConfigService;

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    hubRoutingRule: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({
        cpoCountryCode: "TW",
        cpoPartyId: "CPO",
        emspCountryCode: "TW",
        emspPartyId: "EMP",
        channelStatus: "ERROR_DISABLED",
      }),
    },
  };

  const mockCacheService = {
    syncRuleToRedis: jest.fn(),
    deleteRuleFromRedis: jest.fn(),
  };

  const mockHttpService = {
    put: jest.fn().mockReturnValue(of({ status: 200, data: { success: true } })),
    patch: jest.fn().mockReturnValue(of({ status: 200, data: { success: true } })),
    post: jest.fn().mockReturnValue(of({ status: 200, data: { success: true } })),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === "NOTION_API_KEY") return "secret-key";
      if (key === "NOTION_DATABASE_ID") return "db-id";
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcpiRoutingWorker,
        { provide: HttpService, useValue: mockHttpService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RoutingCacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    worker = module.get<OcpiRoutingWorker>(OcpiRoutingWorker);
    httpService = module.get<HttpService>(HttpService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<RoutingCacheService>(RoutingCacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should process and forward a PUT task correctly", async () => {
    const job: any = {
      id: "job-1",
      data: {
        method: "PUT",
        targetUrl: "http://emsp.com/ocpi/2.2.1/locations",
        token: encrypt("raw-token"),
        payload: { id: "loc-1" },
        headers: {},
      },
    };

    const res = await worker.process(job);
    expect(res).toEqual({ success: true });
    expect(httpService.put).toHaveBeenCalledWith(
      "http://emsp.com/ocpi/2.2.1/locations",
      { id: "loc-1" },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "bearer raw-token",
        }),
      }),
    );
  });

  it("should trigger Circuit Breaker, update DB, sync cache and send Notion alert on final failure", async () => {
    const job: any = {
      id: "job-failed",
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: {
        emspKey: "TW:EMP",
        targetUrl: "http://emsp.com/ocpi/2.2.1/locations",
        cpoCountryCode: "TW",
        cpoPartyId: "CPO",
      },
    };

    const error = new Error("Connection Timeout");
    (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

    await worker.onFailed(job, error);

    // Verify DB update transaction
    expect(prismaService.$transaction).toHaveBeenCalled();
    expect(prismaService.hubRoutingRule.update).toHaveBeenCalledWith({
      where: {
        cpoCountryCode_cpoPartyId_emspCountryCode_emspPartyId: {
          cpoCountryCode: "TW",
          cpoPartyId: "CPO",
          emspCountryCode: "TW",
          emspPartyId: "EMP",
        },
      },
      data: {
        channelStatus: "ERROR_DISABLED",
      },
    });

    // Verify Cache Sync
    expect(cacheService.syncRuleToRedis).toHaveBeenCalled();

    // Verify Notion API Post
    expect(axios.post).toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-key",
        }),
      }),
    );
  });
});
