import { Module } from "@nestjs/common";
import { SimulatorController } from "./simulator.controller";
import { SimulatorService } from "./simulator.service";
import { OcpiModule } from "../ocpi/ocpi.module";
import { EmspModule } from "../emsp/emsp.module";

@Module({
  imports: [OcpiModule, EmspModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}

