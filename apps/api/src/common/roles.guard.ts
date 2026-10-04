import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { AuthUser, ROLES_KEY } from "./decorators";

/** Server-side role enforcement (PRD rule 14). Never rely on the frontend hiding things. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user && (user.role === Role.SUPER_ADMIN || required.includes(user.role))) return true;
    throw new ForbiddenException({ code: "FORBIDDEN", message: "You do not have access to this." });
  }
}
