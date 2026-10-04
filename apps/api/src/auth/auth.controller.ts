import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import type { Request, Response } from "express";
import { AuthUser, CurrentUser, Public } from "../common/decorators";
import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { EmailDto, RegisterDto, ResetPasswordDto, TokenDto } from "./dto";
import { LocalAuthGuard } from "./guards";

const minute = (limit: number) => ({ default: { limit, ttl: 60_000 } });

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Same response whether or not the email is already registered (no account probing). */
  @Public()
  @Throttle(minute(5))
  @HttpCode(202)
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    await this.auth.register(dto);
    return { message: "Check your email to confirm your address and finish creating your account." };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Throttle(minute(10))
  @HttpCode(200)
  @Post("login")
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as User;
    const token = await this.auth.startSession(user, { ip: req.ip, userAgent: req.get("user-agent") });
    res.cookie(env.cookieName, token, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: env.cookieSameSite,
      domain: env.cookieDomain,
      path: "/",
      maxAge: env.sessionTtlDays * 24 * 60 * 60 * 1000,
    });
    return { id: user.id, role: user.role };
  }

  @HttpCode(200)
  @Post("logout")
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.endSession(user.sessionId);
    res.clearCookie(env.cookieName, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: env.cookieSameSite,
      domain: env.cookieDomain,
      path: "/",
    });
    return { ok: true };
  }

  @Public()
  @Throttle(minute(10))
  @HttpCode(200)
  @Post("verify-email")
  async verifyEmail(@Body() dto: TokenDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @Public()
  @Throttle(minute(3))
  @HttpCode(202)
  @Post("resend-verification")
  async resendVerification(@Body() dto: EmailDto) {
    await this.auth.resendVerification(dto.email);
    return { message: "If that address needs confirming, we have sent a new link." };
  }

  @Public()
  @Throttle(minute(3))
  @HttpCode(202)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: EmailDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: "If an account exists for that address, we have sent a reset link." };
  }

  @Public()
  @Throttle(minute(5))
  @HttpCode(200)
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }
}
