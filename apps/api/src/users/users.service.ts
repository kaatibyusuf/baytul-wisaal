import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in user's own account. Built field by field so secrets can never leak out. */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException({ code: "NOT_FOUND", message: "Account not found." });

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      profile: user.profile && {
        fullName: user.profile.fullName,
        preferredName: user.profile.preferredName,
        gender: user.profile.gender,
        maritalStatus: user.profile.maritalStatus,
        location: user.profile.location,
      },
      journey: { programme: enrollment ? enrollment.status : "NOT_STARTED" },
    };
  }
}
