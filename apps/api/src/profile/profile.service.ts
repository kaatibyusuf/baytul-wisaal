import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto";

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async load(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: "NOT_FOUND", message: "Profile not found." });
    return profile;
  }

  private shape(p: Awaited<ReturnType<ProfileService["load"]>>) {
    return {
      fullName: p.fullName,
      preferredName: p.preferredName,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      maritalStatus: p.maritalStatus,
      location: p.location,
      country: p.country,
      region: p.region,
      nationality: p.nationality,
      phone: p.phone,
      education: p.education,
      occupation: p.occupation,
      religiousInfo: p.religiousInfo ?? {},
      familyInfo: p.familyInfo ?? {},
    };
  }

  async get(userId: string) {
    return this.shape(await this.load(userId));
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const current = await this.load(userId);
    const data: Prisma.ProfileUpdateInput = {};
    const simple = ["preferredName", "location", "country", "region", "nationality", "phone", "education", "occupation"] as const;
    for (const k of simple) if (dto[k] !== undefined) data[k] = dto[k];
    if (dto.maritalStatus !== undefined) data.maritalStatus = dto.maritalStatus;
    // Nested objects replace the stored object, so clearing a field is possible.
    if (dto.religiousInfo !== undefined) data.religiousInfo = this.clean(dto.religiousInfo);
    if (dto.familyInfo !== undefined) data.familyInfo = this.clean(dto.familyInfo);

    const updated = await this.prisma.profile.update({ where: { userId }, data });

    if (dto.maritalStatus !== undefined && dto.maritalStatus !== current.maritalStatus) {
      await this.audit.record({
        actorId: userId,
        action: "PROFILE_MARITAL_STATUS_CHANGED",
        targetType: "Profile",
        targetId: current.id,
        metadata: { from: current.maritalStatus, to: dto.maritalStatus },
      });
    }
    return this.shape(updated);
  }

  private clean(obj: object): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ) as Prisma.InputJsonObject;
  }
}
