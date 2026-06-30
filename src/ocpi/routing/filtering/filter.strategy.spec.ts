import { Test, TestingModule } from "@nestjs/testing";
import { RoutingFilterEngine } from "./filter.strategy";

describe("RoutingFilterEngine", () => {
  let filterEngine: RoutingFilterEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutingFilterEngine],
    }).compile();

    filterEngine = module.get<RoutingFilterEngine>(RoutingFilterEngine);
  });

  it("should match by default if no filters are specified", () => {
    const filters = {};
    const payload = { country: "TW", city: "Taipei" };
    expect(filterEngine.evaluate(filters, payload)).toBe(true);
  });

  describe("Geographic regions filter", () => {
    it("should match when country is in filters", () => {
      const filters = { geographic_regions: ["TW", "US"] };
      const payload = { country: "TW" };
      expect(filterEngine.evaluate(filters, payload)).toBe(true);
    });

    it("should match when country is in filters case-insensitively", () => {
      const filters = { geographic_regions: ["tw", "us"] };
      const payload = { country: "TW" };
      expect(filterEngine.evaluate(filters, payload)).toBe(true);
    });

    it("should match when city matches", () => {
      const filters = { geographic_regions: ["Taipei"] };
      const payload = { city: "Taipei" };
      expect(filterEngine.evaluate(filters, payload)).toBe(true);
    });

    it("should fail when country is not in filters", () => {
      const filters = { geographic_regions: ["US", "JP"] };
      const payload = { country: "TW" };
      expect(filterEngine.evaluate(filters, payload)).toBe(false);
    });
  });

  describe("Power types filter", () => {
    it("should match when EVSE connector has matching power type", () => {
      const filters = { power_types: ["DC"] };
      const payload = {
        evses: [
          {
            connectors: [
              { power_type: "AC_3_PHASE" },
              { power_type: "DC" },
            ],
          },
        ],
      };
      expect(filterEngine.evaluate(filters, payload)).toBe(true);
    });

    it("should fail when EVSE connectors do not match power type", () => {
      const filters = { power_types: ["DC"] };
      const payload = {
        evses: [
          {
            connectors: [
              { power_type: "AC_3_PHASE" },
            ],
          },
        ],
      };
      expect(filterEngine.evaluate(filters, payload)).toBe(false);
    });
  });
});
