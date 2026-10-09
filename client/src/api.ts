import axios from 'axios';
import type { AuthResponse, EmployeeUser, Session, TaskItem, TaskStatus } from './types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  withCredentials: true,
});

let accessToken: string | null = sessionStorage.getItem('accessToken');
let refreshRequest: Promise<string> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem('accessToken', token);
  else sessionStorage.removeItem('accessToken');
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || original?._retry || original?.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshRequest ??= api.post<AuthResponse>('/auth/refresh').then(({ data }) => {
      setAccessToken(data.accessToken);
      return data.accessToken;
    }).finally(() => {
      refreshRequest = null;
    });

    await refreshRequest;
    return api(original);
  },
);

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  setAccessToken(data.accessToken);
  return data;
}

export async function restoreSession() {
  try {
    const { data } = await api.get<Session>('/auth/me');
    return data;
  } catch {
    const { data } = await api.post<AuthResponse>('/auth/refresh');
    setAccessToken(data.accessToken);
    return data;
  }
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function listEmployees(search = '') {
  const { data } = await api.get<{ items: EmployeeUser[]; total: number }>('/users', {
    params: { role: 'EMPLOYEE', search: search || undefined, pageSize: 100 },
  });
  return data;
}

export async function listDepartments() {
  const { data } = await api.get<Array<{ id: string; name: string; color: string; jobTitles: Array<{ id: string; name: string }> }>>('/org/departments');
  return data;
}

export async function createEmployee(input: Record<string, unknown>) {
  const { data } = await api.post<EmployeeUser>('/users', input);
  return data;
}

export async function updateEmployee(id: string, input: Record<string, unknown>) {
  const { data } = await api.patch<EmployeeUser>(`/users/${id}`, input);
  return data;
}

export async function listTasks(params: Record<string, string | undefined> = {}) {
  const { data } = await api.get<{ items: TaskItem[]; total: number }>('/tasks', { params: { pageSize: 100, ...params } });
  return data;
}

export async function loadTaskBoard(params: Record<string, string | undefined> = {}) {
  const { data } = await api.get<Array<{ status: TaskStatus; tasks: TaskItem[] }>>('/tasks/board', { params });
  return data;
}

export async function moveTask(id: string, status: TaskStatus, position = 0) {
  const { data } = await api.post<TaskItem>(`/tasks/${id}/move`, { status, position });
  return data;
}

export default api;