import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptors";
import { ThrottlerGuard } from "./common/gurads/throttler.guard";
import { OcpiModule } from "./ocpi/ocpi.module";
import { SimulatorModule } from "./simulator/simulator.module";

@Module({
  imports: [OcpiModule, SimulatorModule],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
