import { ThrottlerGuard } from "./throttler.guard";
import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";

describe("ThrottlerGuard", () => {
  let guard: ThrottlerGuard;
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
      isRateLimited: jest.fn(),
    };
    guard = new ThrottlerGuard(mockPrisma as any, mockRedis as any);
  });

  const createMockContext = (ip: string, headers: Record<string, string> = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow request under the rate limit", async () => {
    const context = createMockContext("127.0.0.1");
    mockRedis.isRateLimited.mockResolvedValueOnce(false);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.isRateLimited).toHaveBeenCalledWith("rate_limit:ip:127.0.0.1", 30, 60);
  });

  it("should block requests when limit is exceeded", async () => {
    const context = createMockContext("192.168.1.1");
    mockRedis.isRateLimited.mockResolvedValueOnce(true);

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      mockRedis.isRateLimited.mockResolvedValueOnce(true);
      await guard.canActivate(context);
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.message).toBe("Too Many Requests - Rate limit exceeded");
    }
  });

  it("should dynamically fetch rate limit for registered tenant from cache/db", async () => {
    const context = createMockContext("1.1.1.1", {
      authorization: "Bearer tenant_token_123",
    });
    mockRedis.getClient().get.mockResolvedValueOnce(
      JSON.stringify({
        id: "tenant-123",
        countryCode: "TW",
        partyId: "NPT",
        role: "CPO",
        rateLimit: 150,
        rateLimitWindow: 120,
      }),
    );
    mockRedis.isRateLimited.mockResolvedValueOnce(false);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedis.isRateLimited).toHaveBeenCalledWith(
      "rate_limit:party:TW:NPT:CPO",
      150,
      120,
    );
  });
});
