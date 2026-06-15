import { Module } from "@nestjs/common";
import { SimulatorController } from "./simulator.controller";
import { SimulatorService } from "./simulator.service";
import { OcpiModule } from "../ocpi/ocpi.module";

@Module({
  imports: [OcpiModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}

