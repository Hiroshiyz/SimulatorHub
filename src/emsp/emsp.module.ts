import { Module } from "@nestjs/common";
import { EmspService } from "./emsp.service";

@Module({
  providers: [EmspService],
  exports: [EmspService],
})
export class EmspModule {}
