

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
  assessmentCompleted?: boolean; // Track if they finished the assessment
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

export interface AssessmentResponse {
  id: string;
  category: 'Study Habits' | 'Personality';
  question: string;
  answer: string;
  label?: string; // Optional label for personality type (e.g. 'Procrastinator')
}

export interface Assessment {
  id: string;
  userId: string;
  submittedAt: number;
  // Flexible array of responses to handle the specific questionnaire
  responses: AssessmentResponse[];
  // Keep old structure optional for backward compatibility if needed, 
  // though we are moving to 'responses'
  studyHabits?: any; 
  personality?: any;
}