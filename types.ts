export type UserRole = 'STUDENT' | 'ADMIN';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  bio?: string;
  createdAt: number;
  requiresPasswordChange?: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate: number; // timestamp
  priority?: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt?: number; // timestamp
  createdAt: number; // timestamp
  overdueNotificationSent?: boolean; // Track if admin has been notified
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
  createdAt: number;
  read: boolean;
  studentId?: string;
}