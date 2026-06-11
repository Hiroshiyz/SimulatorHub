import { ThrottlerGuard } from "./throttler.guard";
import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";

describe("ThrottlerGuard", () => {
  let guard: ThrottlerGuard;

  beforeEach(() => {
    guard = new ThrottlerGuard();
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

  it("should allow request under the rate limit", () => {
    const context = createMockContext("127.0.0.1");
    expect(guard.canActivate(context)).toBe(true);
  });

  it("should block requests when limit is exceeded", () => {
    const context = createMockContext("192.168.1.1");

    // The limit is 30. Send 30 successful requests.
    for (let i = 0; i < 30; i++) {
      expect(guard.canActivate(context)).toBe(true);
    }

    // The 31st request should be blocked and throw an HttpException
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.message).toBe("Too Many Requests - Rate limit exceeded");
    }
  });

  it("should have independent limits for different IPs", () => {
    const clientA = createMockContext("1.1.1.1");
    const clientB = createMockContext("2.2.2.2");

    // Exceed limit for client A
    for (let i = 0; i < 30; i++) {
      expect(guard.canActivate(clientA)).toBe(true);
    }
    expect(() => guard.canActivate(clientA)).toThrow(HttpException);

    // Client B should still be allowed since it's a different IP
    expect(guard.canActivate(clientB)).toBe(true);
  });
});
