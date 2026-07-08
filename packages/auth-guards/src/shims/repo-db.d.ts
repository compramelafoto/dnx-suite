export declare const prisma: AuthGuardsPrismaClient;

export type AuthGuardsPrismaClient = {
  fotofficeWorkspaceBranding: {
    findUnique(args: {
      where: { publicSlug: string };
      select: {
        workspace: {
          select: {
            id: true;
            name: true;
            createdAt: true;
            updatedAt: true;
          };
        };
      };
    }): Promise<{
      workspace: {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      };
    } | null>;
  };
  workspace: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        name: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
  };
  workspaceMembership: {
    findUnique(args: {
      where: { userId_workspaceId: { userId: number; workspaceId: string } };
      select: {
        id: true;
        userId: true;
        workspaceId: true;
        role: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<{
      id: string;
      userId: number;
      workspaceId: string;
      role: "WORKSPACE_OWNER" | "WORKSPACE_ADMIN" | "STAFF";
      createdAt: Date;
      updatedAt: Date;
    } | null>;
    findMany(args: {
      where: { userId: number };
      select: {
        workspace: {
          select: {
            id: true;
            name: true;
            createdAt: true;
            updatedAt: true;
          };
        };
      };
      orderBy: { createdAt: "asc" };
    }): Promise<
      Array<{
        workspace: {
          id: string;
          name: string;
          createdAt: Date;
          updatedAt: Date;
        };
      }>
    >;
  };
  workspaceFeatureModule: {
    findUnique(args: {
      where: { workspaceId_moduleKey: { workspaceId: string; moduleKey: string } };
      select: { enabled: true };
    }): Promise<{ enabled: boolean } | null>;
  };
};
