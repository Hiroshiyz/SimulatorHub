import { ApiKeyGuard } from "./api-key.guard";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let mockPrisma: any;
  let mockRedis: any;
  let mockRedisClient: any;

  beforeEach(() => {
    mockPrisma = {
      credential: {
        findFirst: jest.fn(),
      },
    };
    mockRedisClient = {
      get: jest.fn(),
      setex: jest.fn(),
    };
    mockRedis = {
      getClient: () => mockRedisClient,
    };
    guard = new ApiKeyGuard(mockPrisma as any, mockRedis as any);
  });

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    const req = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow request with valid Bearer token from Redis cache", async () => {
    const context = createMockContext({
      authorization: "Bearer mock_token_b_12345",
    });
    mockRedis.getClient().get.mockResolvedValueOnce(
      JSON.stringify({
        id: "tenant-123",
        countryCode: "TW",
        partyId: "NPT",
        role: "CPO",
      }),
    );

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect((context.switchToHttp().getRequest() as any).party).toEqual({
      id: "tenant-123",
      countryCode: "TW",
      partyId: "NPT",
      role: "CPO",
    });
  });

  it("should allow request with valid Bearer token from Database when cache misses", async () => {
    const context = createMockContext({
      authorization: "Token mock_token_b_12345",
    });
    mockRedis.getClient().get.mockResolvedValueOnce(null);
    mockPrisma.credential.findFirst.mockResolvedValueOnce({
      id: "cred-1",
      tokenB: "mock_token_b_12345",
      party: {
        id: "tenant-123",
        countryCode: "TW",
        partyId: "NPT",
        role: "CPO",
        name: "Test CPO",
      },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.getClient().setex).toHaveBeenCalled();
  });

  it("should throw UnauthorizedException when Authorization header is missing", async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException when Authorization header format is invalid", async () => {
    const context = createMockContext({
      authorization: "mock_token_b_12345",
    });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException when token does not match any credentials in database", async () => {
    const context = createMockContext({
      authorization: "Bearer wrong_token",
    });
    mockRedis.getClient().get.mockResolvedValueOnce(null);
    mockPrisma.credential.findFirst.mockResolvedValueOnce(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
