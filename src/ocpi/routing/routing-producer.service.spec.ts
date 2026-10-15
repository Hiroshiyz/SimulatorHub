import { RoutingProducerService } from "./routing-producer.service";

describe("RoutingProducerService", () => {
  const rule = {
    emspCountryCode: "TW",
    emspPartyId: "EMP",
    contractStatus: "ACTIVE",
    channelStatus: "PROD_ACTIVE",
    routingFilters: {},
    emspBaseUrl: "http://emsp.example",
    emspTokenB: "token-b",
  };
  const queue = { add: jest.fn() };
  const cache = { getActiveRules: jest.fn().mockResolvedValue([rule]) };
  const filter = { evaluate: jest.fn().mockReturnValue(true) };
  const config = { get: jest.fn() };

  it("forwards the OCPI object without the internal emsp_id", async () => {
    const service = new RoutingProducerService(queue as any, cache as any, filter as any, config as any);
    const payload = { id: "SES-1", status: "ACTIVE", emsp_id: "emsp-db-id" };

    await service.enqueueForwardTask("PUT", "sessions/TW/SCT/SES-1", payload, "TW", "SCT", "TW", "EMP");

    const jobData = queue.add.mock.calls[0][1];
    expect(jobData.payload).toEqual({ id: "SES-1", status: "ACTIVE" });
    expect(jobData.headers).toEqual(
      expect.objectContaining({
        "OCPI-from-party-id": "SCT",
        "OCPI-from-country-code": "TW",
        "OCPI-to-party-id": "EMP",
        "OCPI-to-country-code": "TW",
      }),
    );
    // The HUB's own copy is untouched
    expect(payload.emsp_id).toBe("emsp-db-id");
  });
});
