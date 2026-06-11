import { Module } from "@nestjs/common";
import { OcpiModule } from "./ocpi/ocpi.module";

@Module({
  imports: [OcpiModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
