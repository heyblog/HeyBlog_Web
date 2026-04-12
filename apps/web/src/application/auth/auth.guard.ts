export type EffectiveUserRole = 'USER' | 'ADMIN' | 'SYS_ADMIN';
export type ManagementPermissionKey =
  | 'user.manage'
  | 'site_audit.review'
  | 'feedback.review'
  | 'announcement.manage'
  | 'taxonomy.manage'
  | 'site.manage'
  | 'task.manage'
  | 'log.read';

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  role: EffectiveUserRole;
  permissions: ManagementPermissionKey[];
  isActive: boolean;
  isVerified: boolean;
  hasPassword: boolean;
  hasGithub: boolean;
  authVersion: number;
  adminGrantedBy: string | null;
  adminGrantedTime: string | null;
}

export type ProtectionLevel = 'authenticated' | 'management-home' | ManagementPermissionKey;

export interface ManagementNavItem {
  permission: ManagementPermissionKey;
  href: string;
  label: string;
  description: string;
}

export const MANAGEMENT_NAV_ITEMS: ManagementNavItem[] = [
  {
    permission: 'site_audit.review',
    href: '/management/site-submissions',
    label: '站点审核',
    description: '处理博客新增、修改和删除审核',
  },
  {
    permission: 'site.manage',
    href: '/management/sites',
    label: '站点编辑',
    description: '直接维护线上站点信息',
  },
  {
    permission: 'feedback.review',
    href: '/management/feedback',
    label: '反馈处理',
    description: '处理站点和文章反馈',
  },
  {
    permission: 'taxonomy.manage',
    href: '/management/taxonomy',
    label: '标签与目录',
    description: '管理标签、技术目录与标签合并',
  },
  {
    permission: 'announcement.manage',
    href: '/management/announcements',
    label: '公告管理',
    description: '维护首页公告与公开公告归档',
  },
  {
    permission: 'task.manage',
    href: '/management/tasks',
    label: '任务中心',
    description: '管理调度、手动触发与重试',
  },
  {
    permission: 'user.manage',
    href: '/management/users',
    label: '用户与授权',
    description: '提权、降权与模块权限分配',
  },
  {
    permission: 'log.read',
    href: '/management/logs',
    label: '日志查看',
    description: '只读查看 API 运行日志',
  },
];

export const isManagementRole = (user: Pick<SessionUser, 'role'> | null | undefined): boolean =>
  user?.role === 'ADMIN' || user?.role === 'SYS_ADMIN';

export const hasManagementPermission = (
  user: Pick<SessionUser, 'role' | 'permissions'> | null | undefined,
  permission: ManagementPermissionKey,
): boolean => user?.role === 'SYS_ADMIN' || Boolean(user?.permissions.includes(permission));

export const hasAnyManagementPermission = (
  user: Pick<SessionUser, 'role' | 'permissions'> | null | undefined,
): boolean => user?.role === 'SYS_ADMIN' || Boolean(user?.permissions.length);

export const getProtectionLevel = (pathname: string): ProtectionLevel | null => {
  if (pathname.startsWith('/management/users')) {
    return 'user.manage';
  }

  if (pathname.startsWith('/management/site-submissions')) {
    return 'site_audit.review';
  }

  if (pathname.startsWith('/management/feedback')) {
    return 'feedback.review';
  }

  if (pathname.startsWith('/management/announcements')) {
    return 'announcement.manage';
  }

  if (pathname.startsWith('/management/taxonomy')) {
    return 'taxonomy.manage';
  }

  if (pathname.startsWith('/management/sites')) {
    return 'site.manage';
  }

  if (pathname.startsWith('/management/tasks')) {
    return 'task.manage';
  }

  if (pathname.startsWith('/management/logs')) {
    return 'log.read';
  }

  if (pathname === '/management' || pathname.startsWith('/management/')) {
    return 'management-home';
  }

  if (pathname.startsWith('/dashboard')) {
    return 'authenticated';
  }

  return null;
};

export const hasAccessToPath = (user: SessionUser | null, pathname: string): boolean => {
  const protectionLevel = getProtectionLevel(pathname);

  if (!protectionLevel) {
    return true;
  }

  if (!user) {
    return false;
  }

  if (protectionLevel === 'authenticated') {
    return true;
  }

  if (protectionLevel === 'management-home') {
    return isManagementRole(user);
  }

  return isManagementRole(user) && hasManagementPermission(user, protectionLevel);
};
