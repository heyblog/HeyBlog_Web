import type { ManagementPermissionKey } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createManagementService } from '@/application/auth/usecase/auth-management.usecase';
import type { AuthUser } from '@/domain/auth/types/auth.types';

type ManagementDeps = Parameters<typeof createManagementService>[0];

const createActor = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  nickname: 'Admin',
  avatarUrl: null,
  role: 'ADMIN',
  permissions: ['user.manage'],
  isActive: true,
  isVerified: true,
  hasPassword: true,
  hasGithub: false,
  authVersion: 1,
  adminGrantedBy: null,
  adminGrantedTime: null,
  ...overrides,
});

const createUserRow = (
  overrides: Partial<{
    id: string;
    role: 'USER' | 'ADMIN' | 'SYS_ADMIN';
    metadata: Record<string, unknown>;
  }> = {},
) =>
  ({
    id: '22222222-2222-4222-8222-222222222222',
    username: 'target_user',
    email: 'target@example.com',
    nickname: 'Target',
    avatar_url: null,
    password_hash: 'hashed-password',
    role: 'ADMIN',
    is_active: true,
    is_verified: true,
    profile: {},
    settings: {},
    metadata: {
      auth_version: 1,
      admin_granted_by: null,
      admin_granted_time: null,
    },
    created_time: new Date('2026-03-01T00:00:00.000Z'),
    last_login_time: new Date('2026-03-02T00:00:00.000Z'),
    updated_time: new Date('2026-03-03T00:00:00.000Z'),
    ...overrides,
  }) as any;

const createDeps = (options?: {
  targetUser?: ReturnType<typeof createUserRow> | null;
  permissionReads?: ManagementPermissionKey[][];
}) => {
  const permissionQueue = [...(options?.permissionReads ?? [[]])];

  const deps: ManagementDeps = {
    listUsers: vi.fn(async () => []),
    readUserById: vi.fn(async () =>
      options?.targetUser === undefined ? createUserRow() : options.targetUser,
    ),
    readUserPermissions: vi.fn(async () => permissionQueue.shift() ?? []),
    readUserHasGithub: vi.fn(async () => false),
    replaceUserPermissions: vi.fn(async () => undefined),
    clearUserPermissions: vi.fn(async () => undefined),
    updateUserRole: vi.fn(async (target, nextRole) => ({
      ...target,
      role: nextRole,
    })),
  };

  return deps;
};

describe('auth management authorization boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects role changes when actor tries to modify self', async () => {
    const actor = createActor();
    const deps = createDeps();
    const service = createManagementService(deps);

    await expect(service.grantAdminRole(actor, actor.id)).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    });
    expect(deps.readUserById).not.toHaveBeenCalled();
  });

  it('rejects permission updates when actor tries to modify self', async () => {
    const actor = createActor();
    const deps = createDeps();
    const service = createManagementService(deps);

    await expect(
      service.updateUserPermissions(actor, actor.id, ['user.manage']),
    ).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    });
    expect(deps.readUserById).not.toHaveBeenCalled();
  });

  it('rejects out-of-scope permission assignments for delegated managers', async () => {
    const actor = createActor({
      permissions: ['user.manage'],
    });
    const deps = createDeps({
      permissionReads: [[]],
    });
    const service = createManagementService(deps);

    await expect(
      service.updateUserPermissions(actor, '22222222-2222-4222-8222-222222222222', ['site.manage']),
    ).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    });
    expect(deps.replaceUserPermissions).not.toHaveBeenCalled();
  });

  it('rejects updates when target already has out-of-scope permissions', async () => {
    const actor = createActor({
      permissions: ['user.manage'],
    });
    const deps = createDeps({
      permissionReads: [['site.manage']],
    });
    const service = createManagementService(deps);

    await expect(
      service.updateUserPermissions(actor, '22222222-2222-4222-8222-222222222222', ['user.manage']),
    ).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    });
    expect(deps.replaceUserPermissions).not.toHaveBeenCalled();
  });

  it('allows delegated managers to update permissions within their own scope', async () => {
    const actor = createActor({
      permissions: ['user.manage', 'site.manage'],
    });
    const targetUserId = '22222222-2222-4222-8222-222222222222';
    const deps = createDeps({
      permissionReads: [['site.manage'], ['user.manage']],
    });
    const service = createManagementService(deps);

    const updated = await service.updateUserPermissions(actor, targetUserId, ['user.manage']);

    expect(deps.replaceUserPermissions).toHaveBeenCalledWith(
      targetUserId,
      ['user.manage'],
      actor.id,
    );
    expect(updated.permissions).toEqual(['user.manage']);
  });

  it('blocks delegated managers from revoking admins outside their scope', async () => {
    const actor = createActor({
      permissions: ['user.manage'],
    });
    const deps = createDeps({
      permissionReads: [['site.manage']],
    });
    const service = createManagementService(deps);

    await expect(
      service.revokeAdminRole(actor, '22222222-2222-4222-8222-222222222222'),
    ).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    });
    expect(deps.clearUserPermissions).not.toHaveBeenCalled();
    expect(deps.updateUserRole).not.toHaveBeenCalled();
  });

  it('allows SYS_ADMIN to assign permissions without scope restrictions', async () => {
    const actor = createActor({
      role: 'SYS_ADMIN',
      permissions: [],
    });
    const targetUserId = '22222222-2222-4222-8222-222222222222';
    const deps = createDeps({
      permissionReads: [['site.manage'], ['announcement.manage']],
    });
    const service = createManagementService(deps);

    const updated = await service.updateUserPermissions(actor, targetUserId, [
      'announcement.manage',
    ]);

    expect(deps.replaceUserPermissions).toHaveBeenCalledWith(
      targetUserId,
      ['announcement.manage'],
      actor.id,
    );
    expect(updated.permissions).toEqual(['announcement.manage']);
  });
});
