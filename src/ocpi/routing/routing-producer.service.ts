import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { RoutingCacheService } from "./routing-cache.service";
import { RoutingFilterEngine } from "./filtering/filter.strategy";
import { encrypt } from "../../common/utils/crypto";

@Injectable()
export class RoutingProducerService {
  private readonly logger = new Logger(RoutingProducerService.name);

  constructor(
    @InjectQueue("ocpi-routing-queue") private readonly routingQueue: Queue,
    private readonly cacheService: RoutingCacheService,
    private readonly filterEngine: RoutingFilterEngine,
    private readonly configService: ConfigService,
  ) {}

  async enqueueForwardTask(
    method: "POST" | "PUT" | "PATCH",
    subPath: string,
    payload: any,
    cpoCountryCode: string,
    cpoPartyId: string,
  ): Promise<void> {
    this.logger.log(
      `Processing routing for CPO: ${cpoCountryCode}:${cpoPartyId}, subPath: ${subPath}`,
    );

    // Fetch matching rules from cache/DB
    const rules = await this.cacheService.getActiveRules(cpoCountryCode, cpoPartyId);

    if (!rules || rules.length === 0) {
      this.logger.log(`No routing rules found for CPO: ${cpoCountryCode}:${cpoPartyId}`);
      return;
    }

    const mockBaseUrl = this.configService.get<string>("EMSP_BASE_URL");
    const mockTokenB = this.configService.get<string>("CREDENTIALS_TOKEN_B");

    for (const rule of rules) {
      // 1. Check contract_status
      if (rule.contractStatus !== "ACTIVE") {
        this.logger.log(
          `Skipping rule ${rule.emspCountryCode}:${rule.emspPartyId} - contract status is ${rule.contractStatus}`,
        );
        continue;
      }

      // 2. Check channel_status
      if (rule.channelStatus === "ERROR_DISABLED" || rule.channelStatus === "DISABLED") {
        this.logger.log(
          `Skipping rule ${rule.emspCountryCode}:${rule.emspPartyId} - channel status is ${rule.channelStatus}`,
        );
        continue;
      }

      // 3. Evaluate routing filters
      const filterMatch = this.filterEngine.evaluate(rule.routingFilters, payload);
      if (!filterMatch) {
        this.logger.log(
          `Skipping rule ${rule.emspCountryCode}:${rule.emspPartyId} - payload does not match routing filters`,
        );
        continue;
      }

      // Determine URL and Token
      let targetBaseUrl = rule.emspBaseUrl;
      let token = rule.emspTokenB;

      if (rule.channelStatus === "MOCK_TESTING") {
        this.logger.log(
          `MOCK_TESTING enabled for EMSP ${rule.emspCountryCode}:${rule.emspPartyId}. Overwriting target URL and Token with mock credentials.`,
        );
        targetBaseUrl = mockBaseUrl || "http://localhost:5053";
        token = mockTokenB || "mock_cpo_token_b_123";
      }

      const targetUrl = `${targetBaseUrl}/ocpi/2.2.1/${subPath}`;
      const encryptedToken = encrypt(token);
      const emspKey = `${rule.emspCountryCode}:${rule.emspPartyId}`;

      // Package standard headers
      const headers = {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
        "OCPI-to-party-id": rule.emspPartyId,
        "OCPI-to-country-code": rule.emspCountryCode,
        "OCPI-from-party-id": cpoPartyId,
        "OCPI-from-country-code": cpoCountryCode,
      };

      const jobData = {
        method,
        targetUrl,
        token: encryptedToken,
        emspKey,
        payload,
        headers,
        cpoCountryCode,
        cpoPartyId,
      };

      this.logger.log(`Enqueuing forward job to BullMQ for EMSP key: ${emspKey}`);
      await this.routingQueue.add("forward-task", jobData, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: false,   // Keep failed jobs for circuit breaker handling
      });
    }
  }
}
