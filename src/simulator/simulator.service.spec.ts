import { Test, TestingModule } from "@nestjs/testing";
import { SimulatorService } from "./simulator.service";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("SimulatorService", () => {
  let service: SimulatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SimulatorService],
    }).compile();

    service = module.get<SimulatorService>(SimulatorService);
    process.env.EMSP_BASE_URL = "http://localhost:5053";
    process.env.CREDENTIALS_TOKEN_B = "mock_token_b_12345";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("sendLocation", () => {
    it("should send PUT request to EMSP location endpoint", async () => {
      const payload = { id: "loc_1" };
      mockedAxios.put.mockResolvedValueOnce({ data: { status_code: 1000 } });

      const response = await service.sendLocation("TW", "NPT", "loc_1", payload);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:5053/ocpi/2.2.1/locations/TW/NPT/loc_1",
        payload,
        expect.any(Object),
      );
      expect(response).toEqual({ status_code: 1000 });
    });
  });

  describe("sendTariff", () => {
    it("should send PUT request to EMSP tariff endpoint", async () => {
      const payload = { id: "tariff_1" };
      mockedAxios.put.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendTariff("TW", "NPT", "tariff_1", payload);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:5053/ocpi/2.2.1/tariffs/TW/NPT/tariff_1",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendEvseStatus", () => {
    it("should send PATCH request to EMSP EVSE status endpoint", async () => {
      const payload = { status: "AVAILABLE" };
      mockedAxios.patch.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendEvseStatus("TW", "NPT", "loc_1", "evse_1", payload);

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        "http://localhost:5053/ocpi/2.2.1/locations/TW/NPT/loc_1/evse_1",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendSession", () => {
    it("should send PUT request to EMSP session endpoint", async () => {
      const payload = { id: "sess_1" };
      mockedAxios.put.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendSession("TW", "NPT", "sess_1", payload);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "http://localhost:5053/ocpi/2.2.1/sessions/TW/NPT/sess_1",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendCdr", () => {
    it("should send POST request to EMSP CDR endpoint", async () => {
      const payload = { id: "cdr_1" };
      mockedAxios.post.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendCdr(payload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:5053/ocpi/2.2.1/cdrs",
        payload,
        expect.any(Object),
      );
    });
  });

  describe("sendCancelSession", () => {
    it("should send POST request to cancel EMSP session", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { status_code: 1000 } });

      await service.sendCancelSession("TW", "NPT", "txn_123");

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:5053/ocpi/2.2.1/sessions/TW/NPT/txn_123",
        {},
        expect.any(Object),
      );
    });
  });
});
