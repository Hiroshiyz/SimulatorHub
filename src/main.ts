import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  //NestExpressApplication to use useStaticAssets
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = process.env.PORT || 3030;

  app.enableCors({ credentials: true });
  app.useStaticAssets(join(__dirname, "..", "public"));

  await app.listen(port);
  console.log(`OCPI Mock Hub is running on: http://localhost:${port}`);
}
bootstrap();
