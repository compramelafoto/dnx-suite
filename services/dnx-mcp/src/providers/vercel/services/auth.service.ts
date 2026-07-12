import type { VercelHttpClient } from "../client/index.js";
import {
  parseVercelTeam,
  parseVercelTeams,
  parseVercelUser,
  type VercelTeam,
  type VercelUser,
} from "../types/index.js";

export class AuthService {
  constructor(private readonly client: VercelHttpClient) {}

  async getUser(): Promise<VercelUser> {
    const response = await this.client.get<unknown>("/v2/user");
    return parseVercelUser(response);
  }

  async listTeams(): Promise<VercelTeam[]> {
    const response = await this.client.get<unknown>("/v2/teams");
    return parseVercelTeams(response);
  }

  async getTeam(teamId: string): Promise<VercelTeam> {
    const response = await this.client.get<unknown>(`/v2/teams/${teamId}`);
    return parseVercelTeam(response);
  }

  getActiveTeamScope(): { teamId?: string; teamSlug?: string } {
    return {
      ...(this.client.teamId ? { teamId: this.client.teamId } : {}),
      ...(this.client.teamSlug ? { teamSlug: this.client.teamSlug } : {}),
    };
  }
}
