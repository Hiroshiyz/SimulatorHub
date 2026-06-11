import { LoggingInterceptor } from "./logging.interceptors";
import { ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { of, throwError } from "rxjs";

describe("LoggingInterceptor", () => {
  let interceptor: LoggingInterceptor;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    // Spy on NestJS Logger calls
    loggerLogSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (request: any, response: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it("should log request/response success details", (done) => {
    const mockRequest = {
      method: "GET",
      url: "/ocpi/versions",
      headers: { authorization: "Bearer token123" },
      body: { test: "data" },
    };
    const mockResponse = { statusCode: 200 };
    const mockContext = createMockContext(mockRequest, mockResponse);

    const mockCallHandler: CallHandler = {
      handle: () => of({ data: "successResponse" }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ data: "successResponse" });
        expect(loggerLogSpy).toHaveBeenCalled();
        const logMsg = loggerLogSpy.mock.calls[0][0];
        expect(logMsg).toContain("[HTTP SUCCESS]GET /ocpi/versions");
        expect(logMsg).toContain("Response Body: {\"data\":\"successResponse\"}");
        expect(logMsg).toContain("Request Headers: {\"authorization\":\"******************\"}");
        done();
      },
    });
  });

  it("should log request error details", (done) => {
    const mockRequest = {
      method: "POST",
      url: "/simulate/cdrs",
      headers: {},
      body: { bad: "data" },
    };
    const mockContext = createMockContext(mockRequest, {});

    const mockCallHandler: CallHandler = {
      handle: () => throwError(() => ({ statusCode: 400, message: "Bad Request" })),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err).toEqual({ statusCode: 400, message: "Bad Request" });
        expect(loggerErrorSpy).toHaveBeenCalled();
        const errorMsg = loggerErrorSpy.mock.calls[0][0];
        expect(errorMsg).toContain("[HTTP ERROR]POST /simulate/cdrs");
        expect(errorMsg).toContain("Error Message: Bad Request");
        done();
      },
    });
  });
});
