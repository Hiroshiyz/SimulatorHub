import { Module } from "@nestjs/common";
import { OcpiController } from "./ocpi.controller";
import { OcpiService } from "./ocpi.service";
import { EmspModule } from "../emsp/emsp.module";

@Module({
  imports: [EmspModule],
  controllers: [OcpiController],
  providers: [OcpiService],
  exports: [OcpiService],
})
export class OcpiModule {}

