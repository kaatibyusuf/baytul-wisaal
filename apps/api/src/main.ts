import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // PRD section 40: versioned REST API under /api/v1
  app.setGlobalPrefix("api/v1");

  // PRD section 35: secure headers, server-side validation, no trust in the client
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Browser clients: the user web app and the admin app only
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
    credentials: true,
  });

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
