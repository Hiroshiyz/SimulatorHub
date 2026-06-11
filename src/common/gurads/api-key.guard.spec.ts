import { ApiKeyGuard } from "./api-key.guard";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    guard = new ApiKeyGuard();
    process.env.CREDENTIALS_TOKEN_B = "mock_token_b_12345";
  });

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow request with valid Bearer token", () => {
    const context = createMockContext({
      authorization: "Bearer mock_token_b_12345",
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("should allow request with valid Token prefix (OCPI standard)", () => {
    const context = createMockContext({
      authorization: "Token mock_token_b_12345",
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("should throw UnauthorizedException when Authorization header is missing", () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow("Missing Authorization header");
  });

  it("should throw UnauthorizedException when Authorization header format is invalid", () => {
    const context = createMockContext({
      authorization: "mock_token_b_12345",
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow("Invalid Authorization header format");
  });

  it("should throw UnauthorizedException when prefix is not Token or Bearer", () => {
    const context = createMockContext({
      authorization: "Basic mock_token_b_12345",
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException when token does not match Token B", () => {
    const context = createMockContext({
      authorization: "Bearer wrong_token",
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow("Invalid OCPI credentials");
  });
});
