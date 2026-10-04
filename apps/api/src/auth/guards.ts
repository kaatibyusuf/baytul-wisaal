import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../common/decorators";

/** Global guard: every route needs a valid session unless marked @Public(). */
@Injectable()
export class SessionAuthGuard extends AuthGuard("session") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException({ code: "UNAUTHENTICATED", message: "Please sign in." });
    }
    return user;
  }
}

/** Used only on POST /auth/login. */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  handleRequest<T>(err: unknown, user: T): T {
    if (err) throw err;
    if (!user) {
      throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    }
    return user;
  }
}
