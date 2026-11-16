import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decrypt } from "../../common/utils/crypto";
import { firstValueFrom } from "rxjs";
import axios from "axios";

@Processor("ocpi-routing-queue")
@Injectable()
export class OcpiRoutingWorker extends WorkerHost {
  private readonly logger = new Logger(OcpiRoutingWorker.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { method, targetUrl, token, payload, headers } = job.data;
    this.logger.log(`Processing job ${job.id} for target: ${targetUrl}`);

    const decryptedToken = decrypt(token);

    // Prepare headers
    const requestHeaders = {
      ...headers,
      Authorization: `Bearer ${decryptedToken}`,
    };

    let response;
    if (method === "PUT") {
      response = await firstValueFrom(
        this.httpService.put(targetUrl, payload, { headers: requestHeaders }),
      );
    } else if (method === "PATCH") {
      response = await firstValueFrom(
        this.httpService.patch(targetUrl, payload, { headers: requestHeaders }),
      );
    } else if (method === "POST") {
      response = await firstValueFrom(
        this.httpService.post(targetUrl, payload, { headers: requestHeaders }),
      );
    } else {
      throw new Error(`Unsupported routing method: ${method}`);
    }

    this.logger.log(
      `Successfully forwarded job ${job.id} to ${targetUrl}. Status Code: ${response.status}`,
    );
    return response.data;
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<any>, error: any) {
    let errorMsg = error?.message;

    if (error?.name === "AggregateError" && Array.isArray(error.errors)) {
      errorMsg = `AggregateError: ${error.errors.map((e: any) => e.message).join(", ")}`;
    } else if (!errorMsg && error?.code) {
      errorMsg = `Connection failed with code ${error.code}`;
    }

    if (!errorMsg) {
      errorMsg = typeof error === "object" ? (error.name || "Unknown Error") : String(error);
    }

    this.logger.error(`Job ${job.id} failed: ${errorMsg}`, error?.stack);

    // Exhausted jobs remain failed; new jobs can still use the channel.
    const maxAttempts = job.opts.attempts || 3;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.warn(
        `Job ${job.id} has failed after all ${maxAttempts} attempts. Channel status unchanged.`,
      );

      const { emspKey, targetUrl } = job.data;
      await this.createNotionIncident(job.id || `JOB-${Date.now()}`, emspKey, targetUrl, errorMsg);
    }
  }

  private async createNotionIncident(
    jobId: string,
    emspKey: string,
    targetUrl: string,
    errorMessage: string,
  ): Promise<void> {
    const notionApiKey = this.configService.get<string>("NOTION_API_KEY");
    const notionDatabaseId = this.configService.get<string>("NOTION_DATABASE_ID");

    if (!notionApiKey || !notionDatabaseId) {
      this.logger.warn(
        "Notion credentials NOTION_API_KEY or NOTION_DATABASE_ID are missing in env. Skipping incident creation.",
      );
      return;
    }

    this.logger.log(`Creating Notion Incident for job: ${jobId}`);

    const url = "https://api.notion.com/v1/pages";
    const requestBody = {
      parent: { database_id: notionDatabaseId },
      properties: {
        "Incident ID": {
          title: [
            {
              text: {
                content: jobId,
              },
            },
          ],
        },
        "EMSP ID": {
          rich_text: [
            {
              text: {
                content: emspKey,
              },
            },
          ],
        },
        "targetURL": {
          url: targetUrl,
        },
        Status: {
          status: {
            name: "Pending", // 🔴 Pending
          },
        },
        "Error Message": {
          rich_text: [
            {
              text: {
                content: errorMessage.substring(0, 2000), // Notion rich text limit is 2000 chars
              },
            },
          ],
        },
        TimeStamp: {
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    };

    try {
      await axios.post(url, requestBody, {
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      });
      this.logger.log(`Successfully logged incident in Notion Database for ${emspKey}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to create Notion incident: ${
          err.response?.data ? JSON.stringify(err.response.data) : err.message
        }`,
      );
    }
  }
}
