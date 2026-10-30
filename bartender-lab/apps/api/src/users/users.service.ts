import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { UserProfileDto } from '../auth/dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toUserProfile } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserProfile(user);
  }

  async updateProfile(userId: string, displayName: string): Promise<UserProfileDto> {
    return toUserProfile(
      await this.prisma.user.update({ where: { id: userId }, data: { displayName } }),
    );
  }

  /** Admin-only. Refuses to demote the last remaining admin so the system is never left without one. */
  async updateRole(userId: string, role: UserRole): Promise<UserProfileDto> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      if (user.role === 'ADMIN' && role !== 'ADMIN') {
        const admins = await tx.user.count({ where: { role: 'ADMIN' } });
        if (admins <= 1) throw new ConflictException('Cannot demote the last admin');
      }
      return toUserProfile(await tx.user.update({ where: { id: userId }, data: { role } }));
    });
  }
}
