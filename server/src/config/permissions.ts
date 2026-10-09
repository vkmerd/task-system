import { AdminType, Role } from '@prisma/client';

/**
 * Yetkiler "kaynak:eylem" seklinde string sabitler.
 * Rol -> varsayilan set, admin tipi -> ustune eklenen set, kullanici bazinda da
 * extraPermissions / deniedPermissions ile ince ayar yapilabilir.
 */
export const PERMISSIONS = {
  // Kullanici & ekip
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Musteri
  CUSTOMER_READ_ALL: 'customer:read:all',
  CUSTOMER_READ_ASSIGNED: 'customer:read:assigned',
  CUSTOMER_WRITE: 'customer:write',
  CUSTOMER_DELETE: 'customer:delete',

  // Is
  TASK_READ_ALL: 'task:read:all',
  TASK_READ_ASSIGNED: 'task:read:assigned',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_ASSIGN: 'task:assign',
  TASK_DELETE: 'task:delete',
  TASK_APPROVE: 'task:approve',

  // Zaman kaydi
  TIMELOG_WRITE: 'timelog:write',
  TIMELOG_READ_ALL: 'timelog:read:all',

  // Finans
  FINANCE_READ: 'finance:read',
  FINANCE_WRITE: 'finance:write',

  // Raporlar
  REPORT_OPERATIONS: 'report:operations',
  REPORT_FINANCE: 'report:finance',
  REPORT_SALES: 'report:sales',

  // Sistem
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

/** Rol bazli taban yetkiler */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    // Admin tabani kasitli olarak dar tutuldu; asil yetki admin tipinden gelir.
    P.USER_READ,
    P.CUSTOMER_READ_ALL,
    P.TASK_READ_ALL,
    P.TIMELOG_WRITE,
  ],
  EMPLOYEE: [
    P.CUSTOMER_READ_ASSIGNED,
    P.TASK_READ_ASSIGNED,
    P.TASK_UPDATE,
    P.TIMELOG_WRITE,
    P.USER_READ,
  ],
  CUSTOMER: [
    // Musteri sadece kendi kayitlarini gorur; kapsam kontrolu servis katmaninda.
    P.TASK_READ_ASSIGNED,
  ],
};

/** Admin tipine gore eklenen yetkiler - panelleri birbirinden ayiran sey budur */
const ADMIN_TYPE_PERMISSIONS: Record<AdminType, Permission[]> = {
  SUPER_ADMIN: Object.values(P) as Permission[],
  OPERATIONS_ADMIN: [
    P.USER_READ,
    P.USER_WRITE,
    P.CUSTOMER_READ_ALL,
    P.CUSTOMER_WRITE,
    P.TASK_READ_ALL,
    P.TASK_CREATE,
    P.TASK_UPDATE,
    P.TASK_ASSIGN,
    P.TASK_DELETE,
    P.TASK_APPROVE,
    P.TIMELOG_READ_ALL,
    P.TIMELOG_WRITE,
    P.REPORT_OPERATIONS,
  ],
  FINANCE_ADMIN: [
    P.CUSTOMER_READ_ALL,
    P.TASK_READ_ALL,
    P.TIMELOG_READ_ALL,
    P.FINANCE_READ,
    P.FINANCE_WRITE,
    P.REPORT_FINANCE,
    P.REPORT_OPERATIONS,
  ],
  SALES_ADMIN: [
    P.CUSTOMER_READ_ALL,
    P.CUSTOMER_WRITE,
    P.TASK_READ_ALL,
    P.TASK_CREATE,
    P.FINANCE_READ,
    P.REPORT_SALES,
  ],
};

export interface PermissionSubject {
  role: Role;
  adminType?: AdminType | null;
  extraPermissions?: string[];
  deniedPermissions?: string[];
}

/** Bir kullanicinin efektif yetki listesini hesaplar. */
export function resolvePermissions(user: PermissionSubject): Permission[] {
  const set = new Set<string>(ROLE_PERMISSIONS[user.role]);

  if (user.role === 'ADMIN' && user.adminType) {
    for (const perm of ADMIN_TYPE_PERMISSIONS[user.adminType]) set.add(perm);
  }
  for (const perm of user.extraPermissions ?? []) set.add(perm);
  for (const perm of user.deniedPermissions ?? []) set.delete(perm);

  return [...set] as Permission[];
}

export function hasPermission(permissions: string[], required: Permission): boolean {
  return permissions.includes(required);
}

/**
 * Admin tipine gore panel duzeni. Frontend bu tanimi okuyup dashboard'u kurar,
 * boylece her admin girisinde farkli bir panel gorur.
 */
export interface DashboardLayout {
  title: string;
  subtitle: string;
  widgets: string[];
  /** Sol menude gosterilecek bolumler */
  nav: string[];
}

export const ADMIN_DASHBOARDS: Record<AdminType, DashboardLayout> = {
  SUPER_ADMIN: {
    title: 'Yonetim Merkezi',
    subtitle: 'Ajansin tamamina dair ozet',
    widgets: [
      'agency-kpis',
      'workload-heatmap',
      'customer-health',
      'revenue-summary',
      'overdue-tasks',
      'team-utilization',
      'recent-activity',
    ],
    nav: ['dashboard', 'tasks', 'customers', 'team', 'reports', 'finance', 'settings'],
  },
  OPERATIONS_ADMIN: {
    title: 'Operasyon Paneli',
    subtitle: 'Is dagilimi, kapasite ve teslim takibi',
    widgets: [
      'workload-heatmap',
      'unassigned-tasks',
      'overdue-tasks',
      'due-this-week',
      'team-utilization',
      'status-breakdown',
      'recent-activity',
    ],
    nav: ['dashboard', 'tasks', 'board', 'customers', 'team', 'reports'],
  },
  FINANCE_ADMIN: {
    title: 'Finans Paneli',
    subtitle: 'Sozlesme, karlilik ve maliyet takibi',
    widgets: [
      'revenue-summary',
      'customer-profitability',
      'contract-hours-usage',
      'billable-ratio',
      'expiring-contracts',
    ],
    nav: ['dashboard', 'customers', 'finance', 'reports'],
  },
  SALES_ADMIN: {
    title: 'Satis Paneli',
    subtitle: 'Musteri kazanimi ve portfoy gelisimi',
    widgets: [
      'pipeline-summary',
      'customer-health',
      'new-customers',
      'expiring-contracts',
      'revenue-summary',
    ],
    nav: ['dashboard', 'customers', 'tasks', 'reports'],
  },
};

export const EMPLOYEE_DASHBOARD: DashboardLayout = {
  title: 'Calisma Panelim',
  subtitle: 'Bugun yapilacaklar ve acik islerim',
  widgets: ['my-tasks-today', 'my-workload', 'my-overdue', 'my-customers', 'my-time-summary'],
  nav: ['dashboard', 'my-tasks', 'board', 'customers', 'timesheet'],
};

export const CUSTOMER_DASHBOARD: DashboardLayout = {
  title: 'Musteri Paneli',
  subtitle: 'Islerinizin guncel durumu',
  widgets: ['customer-progress', 'customer-open-tasks', 'customer-approvals', 'customer-team'],
  nav: ['dashboard', 'my-requests', 'approvals'],
};
