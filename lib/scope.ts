import { Role, type Prisma, type User } from "@prisma/client";

export function projectScopeWhere(user: Pick<User, "id" | "orgId" | "role">): Prisma.ProjectWhereInput {
  const base: Prisma.ProjectWhereInput = { orgId: user.orgId };

  if (user.role === Role.ADMIN || user.role === Role.OWNER || user.role === Role.ACCOUNTANT) {
    return base;
  }

  if (user.role === Role.PROJECT_MANAGER || user.role === Role.FIELD_AGENT) {
    return {
      ...base,
      assignments: {
        some: {
          userId: user.id
        }
      }
    };
  }

  if (user.role === Role.BANKER) {
    return {
      ...base,
      loans: {
        some: {
          bankers: {
            some: {
              userId: user.id
            }
          }
        }
      }
    };
  }

  return base;
}
