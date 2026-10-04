import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { env } from "../config/env";

/**
 * CSRF defence for cookie sessions (PRD section 35), layered with SameSite cookies,
 * strict CORS and JSON-only bodies. State-changing requests that carry an Origin header
 * must come from one of our own web apps. Non-browser clients send no Origin and carry
 * no ambient cookie, so they are unaffected.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const origin = req.headers.origin;
    if (!origin || env.webOrigins.includes(origin)) return true;
    throw new ForbiddenException({ code: "BAD_ORIGIN", message: "Request origin not allowed." });
  }
}
