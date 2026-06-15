import { Module } from "@nestjs/common";
import { OcpiController } from "./ocpi.controller";
import { OcpiService } from "./ocpi.service";

@Module({
  imports: [],
  controllers: [OcpiController],
  providers: [OcpiService],
  exports: [OcpiService],
})
export class OcpiModule {}

