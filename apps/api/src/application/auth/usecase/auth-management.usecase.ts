import type { ManagementPermissionKey } from '@zhblogs/db';

import { canManageUsers } from '@/domain/auth/service/auth-role.service';
import {
  buildManagedUserSnapshot,
  readMetadata,
  type UserRow,
} from '@/domain/auth/service/auth-user.service';
import { AuthError, type AuthUser, type ManagedUserSnapshot } from '@/domain/auth/types/auth.types';

type ManagementDeps = {
  listUsers: () => Promise<UserRow[]>;
  readUserById: (userId: string) => Promise<UserRow | null>;
  readUserPermissions: (userId: string) => Promise<ManagementPermissionKey[]>;
  readUserHasGithub: (userId: string) => Promise<boolean>;
  replaceUserPermissions: (
    targetUserId: string,
    permissions: ManagementPermissionKey[],
    actorId: string,
  ) => Promise<void>;
  clearUserPermissions: (targetUserId: string) => Promise<void>;
  updateUserRole: (
    target: UserRow,
    nextRole: UserRow['role'],
    actorId: string | null,
  ) => Promise<UserRow>;
};

const ensureCanManageUsers = (actor: AuthUser): void => {
  if (!canManageUsers(actor)) {
    throw new AuthError('forbidden', 'user.manage required', 403);
  }
};

const ensureNotManagingSelf = (actor: AuthUser, targetUserId: string): void => {
  if (actor.id === targetUserId) {
    throw new AuthError('forbidden', 'Cannot modify your own role or permissions', 403);
  }
};

const ensurePermissionScope = (
  actor: AuthUser,
  currentPermissions: ManagementPermissionKey[],
  nextPermissions: ManagementPermissionKey[],
): void => {
  if (actor.role === 'SYS_ADMIN') {
    return;
  }

  const actorPermissionSet = new Set(actor.permissions);
  const outOfScopeCurrent = currentPermissions.find(
    (permission) => !actorPermissionSet.has(permission),
  );

  if (outOfScopeCurrent) {
    throw new AuthError(
      'forbidden',
      'Target user has permissions outside your authorization scope',
      403,
    );
  }

  const outOfScopeNext = nextPermissions.find((permission) => !actorPermissionSet.has(permission));

  if (outOfScopeNext) {
    throw new AuthError('forbidden', `Cannot assign permission: ${outOfScopeNext}`, 403);
  }
};

export const createManagementService = (deps: ManagementDeps) => ({
  listManagedUsers: async (): Promise<ManagedUserSnapshot[]> => {
    const users = await deps.listUsers();
    const [permissionEntries, githubEntries] = await Promise.all([
      Promise.all(
        users.map(async (user) => [user.id, await deps.readUserPermissions(user.id)] as const),
      ),
      Promise.all(
        users.map(async (user) => [user.id, await deps.readUserHasGithub(user.id)] as const),
      ),
    ]);
    const permissionByUserId = new Map(permissionEntries);
    const githubByUserId = new Map(githubEntries);
    return users.map((user) =>
      buildManagedUserSnapshot(
        user,
        permissionByUserId.get(user.id) ?? [],
        githubByUserId.get(user.id) ?? false,
      ),
    );
  },

  grantAdminRole: async (actor: AuthUser, targetUserId: string): Promise<ManagedUserSnapshot> => {
    ensureCanManageUsers(actor);
    ensureNotManagingSelf(actor, targetUserId);

    const target = await deps.readUserById(targetUserId);

    if (!target) {
      throw new AuthError('user_not_found', 'User not found', 404);
    }

    if (target.role === 'SYS_ADMIN') {
      throw new AuthError('forbidden', 'SYS_ADMIN role cannot be changed through this flow', 403);
    }

    const updatedUser = await deps.updateUserRole(target, 'ADMIN', actor.id);
    const permissions = await deps.readUserPermissions(updatedUser.id);
    return buildManagedUserSnapshot(
      updatedUser,
      permissions,
      await deps.readUserHasGithub(updatedUser.id),
    );
  },

  revokeAdminRole: async (actor: AuthUser, targetUserId: string): Promise<ManagedUserSnapshot> => {
    ensureCanManageUsers(actor);
    ensureNotManagingSelf(actor, targetUserId);

    const target = await deps.readUserById(targetUserId);

    if (!target) {
      throw new AuthError('user_not_found', 'User not found', 404);
    }

    if (target.role === 'SYS_ADMIN') {
      throw new AuthError(
        'forbidden',
        'SYS_ADMIN role cannot be revoked through admin grant flow',
        403,
      );
    }

    const currentPermissions = await deps.readUserPermissions(target.id);
    ensurePermissionScope(actor, currentPermissions, currentPermissions);

    await deps.clearUserPermissions(target.id);
    const updatedUser = await deps.updateUserRole(target, 'USER', null);
    return buildManagedUserSnapshot(updatedUser, [], await deps.readUserHasGithub(updatedUser.id));
  },

  updateUserPermissions: async (
    actor: AuthUser,
    targetUserId: string,
    permissions: ManagementPermissionKey[],
  ): Promise<ManagedUserSnapshot> => {
    ensureCanManageUsers(actor);
    ensureNotManagingSelf(actor, targetUserId);

    const target = await deps.readUserById(targetUserId);

    if (!target) {
      throw new AuthError('user_not_found', 'User not found', 404);
    }

    if (target.role !== 'ADMIN') {
      throw new AuthError('forbidden', 'Only ADMIN users can receive management permissions', 403);
    }

    const currentPermissions = await deps.readUserPermissions(target.id);
    ensurePermissionScope(actor, currentPermissions, permissions);

    await deps.replaceUserPermissions(target.id, permissions, actor.id);
    const updatedPermissions = await deps.readUserPermissions(target.id);
    return buildManagedUserSnapshot(
      target,
      updatedPermissions,
      await deps.readUserHasGithub(target.id),
    );
  },
});

export const buildNextRoleMetadata = (
  target: UserRow,
  actorId: string | null,
): Record<string, unknown> => {
  const metadata = readMetadata(target.metadata);

  return {
    ...(target.metadata ?? {}),
    auth_version: metadata.auth_version + 1,
    admin_granted_by: actorId,
    admin_granted_time: actorId ? new Date().toISOString() : null,
  };
};
