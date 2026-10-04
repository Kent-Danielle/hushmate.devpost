import { Injectable, NotFoundException } from '@nestjs/common';
import { HousesService } from './houses.service.js';

@Injectable()
export class InvitesService {
  constructor(private readonly houses: HousesService) {}

  async lookup(token: string): Promise<{ name: string; code: string }> {
    const house = await this.houses.findByInviteToken(token);
    if (!house) throw new NotFoundException('Invite not found');
    return { name: house.name, code: house.code };
  }

  async join(userId: string, token: string): Promise<{ membershipId: string; status: 'pending' }> {
    const house = await this.houses.findByInviteToken(token);
    if (!house) throw new NotFoundException('Invite not found');
    return this.houses.join(userId, house.id);
  }
}
