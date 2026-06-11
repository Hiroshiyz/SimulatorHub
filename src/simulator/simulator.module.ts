import { Module } from "@nestjs/common";
import { SimulatorController } from "./simulator.controller";
import { SimulatorService } from "./simulator.service";

@Module({
  imports: [],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}
