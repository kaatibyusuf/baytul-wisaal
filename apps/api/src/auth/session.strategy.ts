import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-custom";
import { env } from "../config/env";
import { AuthService } from "./auth.service";

/** Authenticates every protected request from the HTTP-only session cookie. */
@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, "session") {
  constructor(private readonly auth: AuthService) {
    super();
  }

  async validate(req: Request) {
    const token = req.cookies?.[env.cookieName];
    if (typeof token !== "string" || token.length < 20) return null;
    return this.auth.userForSessionToken(token);
  }
}
