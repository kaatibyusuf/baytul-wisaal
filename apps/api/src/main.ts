import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy (Railway, Render, Fly...) set TRUST_PROXY=1 so client IPs are correct
  // for rate limiting and session records.
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

  // PRD section 40: versioned REST API under /api/v1
  app.setGlobalPrefix("api/v1");

  // PRD section 35: secure headers, cookie parsing, server-side validation, no trust in the client
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Browser clients: the user web app and the admin app only
  app.enableCors({ origin: env.webOrigins, credentials: true });

  // PRD section 40: OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle("Baytul Wisaal API")
    .setDescription("Authoritative backend for Baytul Wisaal")
    .setVersion("1")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`Baytul Wisaal API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
