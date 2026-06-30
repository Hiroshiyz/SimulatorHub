import { Module } from "@nestjs/common";
import { OcpiController } from "./ocpi.controller";
import { OcpiService } from "./ocpi.service";
import { EmspModule } from "../emsp/emsp.module";
import { RoutingModule } from "./routing/routing.module";

@Module({
  imports: [EmspModule, RoutingModule],
  controllers: [OcpiController],
  providers: [OcpiService],
  exports: [OcpiService],
})
export class OcpiModule {}


