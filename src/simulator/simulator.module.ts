import { Module } from "@nestjs/common";
import { SimulatorController } from "./simulator.controller";
import { SimulatorService } from "./simulator.service";
import { OcpiModule } from "../ocpi/ocpi.module";
import { EmspModule } from "../emsp/emsp.module";
import { RoutingModule } from "../ocpi/routing/routing.module";

@Module({
  imports: [OcpiModule, EmspModule, RoutingModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}

