import { Test, TestingModule } from "@nestjs/testing";
import { SimulatorController } from "./simulator.controller";
import { SimulatorService } from "./simulator.service";

describe("SimulatorController", () => {
  let controller: SimulatorController;
  let service: SimulatorService;

  const mockSimulatorService = {
    sendLocation: jest.fn().mockResolvedValue({ status_code: 1000 }),
    sendTariff: jest.fn().mockResolvedValue({ status_code: 1000 }),
    sendEvseStatus: jest.fn().mockResolvedValue({ status_code: 1000 }),
    sendSession: jest.fn().mockResolvedValue({ status_code: 1000 }),
    sendCdr: jest.fn().mockResolvedValue({ status_code: 1000 }),
    sendCancelSession: jest.fn().mockResolvedValue({ status_code: 1000 }),
    getEventStream: jest.fn().mockReturnValue({}),
    registerCpo: jest.fn().mockResolvedValue({ id: "1" }),
    registerEmsp: jest.fn().mockResolvedValue({ id: "2" }),
    getCpos: jest.fn().mockResolvedValue([]),
    getEmspStatus: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulatorController],
      providers: [
        {
          provide: SimulatorService,
          useValue: mockSimulatorService,
        },
      ],
    }).compile();

    controller = module.get<SimulatorController>(SimulatorController);
    service = module.get<SimulatorService>(SimulatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("simulateSendLocation", () => {
    it("should call service.sendLocation", async () => {
      const payload = { test: "val" };
      await controller.simulateSendLocation("TW", "NPT", "loc_1", payload);
      expect(service.sendLocation).toHaveBeenCalledWith("TW", "NPT", "loc_1", payload);
    });
  });

  describe("simulateSendTariff", () => {
    it("should call service.sendTariff", async () => {
      const payload = { test: "val" };
      await controller.simulateSendTariff("TW", "NPT", "tariff_1", payload);
      expect(service.sendTariff).toHaveBeenCalledWith("TW", "NPT", "tariff_1", payload);
    });
  });

  describe("simulateSendEvseStatus", () => {
    it("should call service.sendEvseStatus", async () => {
      const payload = { status: "AVAILABLE" };
      await controller.simulateSendEvseStatus("TW", "NPT", "loc_1", "evse_1", payload);
      expect(service.sendEvseStatus).toHaveBeenCalledWith("TW", "NPT", "loc_1", "evse_1", payload);
    });
  });

  describe("simulateSendSession", () => {
    it("should call service.sendSession", async () => {
      const payload = { test: "val" };
      await controller.simulateSendSession("TW", "NPT", "sess_1", payload);
      expect(service.sendSession).toHaveBeenCalledWith("TW", "NPT", "sess_1", payload);
    });
  });

  describe("simulateSendCdr", () => {
    it("should call service.sendCdr", async () => {
      const payload = { test: "val" };
      await controller.simulateSendCdr(payload);
      expect(service.sendCdr).toHaveBeenCalledWith(payload);
    });
  });

  describe("simulateSendCancelSession", () => {
    it("should call service.sendCancelSession", async () => {
      await controller.simulateSendCancelSession("TW", "NPT", "txn_1");
      expect(service.sendCancelSession).toHaveBeenCalledWith("TW", "NPT", "txn_1");
    });
  });

  describe("sendEvents", () => {
    it("should call service.getEventStream", () => {
      controller.sendEvents();
      expect(service.getEventStream).toHaveBeenCalled();
    });
  });

  describe("registerCpo", () => {
    it("should call service.registerCpo", async () => {
      const payload = {
        countryCode: "TW",
        partyId: "EVZ",
        name: "Test CPO",
        tokenB: "mock_token_b",
      };
      await controller.registerCpo(payload);
      expect(service.registerCpo).toHaveBeenCalledWith(payload);
    });
  });

  describe("registerEmsp", () => {
    it("should call service.registerEmsp", async () => {
      const payload = {
        countryCode: "TW",
        partyId: "EVZ_EMSP",
        name: "Test EMSP",
        url: "http://localhost:5053",
        tokenC: "mock_token_c",
      };
      await controller.registerEmsp(payload);
      expect(service.registerEmsp).toHaveBeenCalledWith(payload);
    });
  });

  describe("getCpos", () => {
    it("should call service.getCpos", async () => {
      await controller.getCpos();
      expect(service.getCpos).toHaveBeenCalled();
    });
  });

  describe("getEmspsStatus", () => {
    it("should call service.getEmspsStatus", async () => {
      await controller.getEmspsStatus();
      expect(service.getEmspStatus).toHaveBeenCalled();
    });
  });
});
