export type Role = 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';

export interface DashboardLayout {
  title: string;
  subtitle: string;
  widgets: string[];
  nav: string[];
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  adminType?: string | null;
  status: string;
  employeeProfile?: {
    jobTitle?: { name: string } | null;
    department?: { name: string; color: string } | null;
  } | null;
  customerContact?: {
    position: string;
    customer: { companyName: string; logoUrl?: string | null };
  } | null;
}

export interface Session {
  user: SessionUser;
  permissions: string[];
  dashboard: DashboardLayout;
}

export interface AuthResponse extends Session {
  accessToken: string;
}

export interface EmployeeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: string;
  employeeProfile?: {
    employeeCode?: string | null;
    weeklyCapacityHours: number;
    workMode: 'OFFICE' | 'REMOTE' | 'HYBRID';
    hireDate?: string | null;
    skills: string[];
    bio?: string | null;
    jobTitle: { id: string; name: string; level: number };
    department: { id: string; name: string; color: string };
  } | null;
}

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'REVISION' | 'WAITING_CUSTOMER' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskItem {
  id: string;
  code: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours?: number | null;
  dueDate?: string | null;
  tags: string[];
  customer: { id: string; companyName: string; logoUrl?: string | null };
  project?: { id: string; name: string; color: string } | null;
  assignee?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null; employeeProfile?: { jobTitle: { name: string } } | null } | null;
  _count: { comments: number; attachments: number; checklist: number };
}