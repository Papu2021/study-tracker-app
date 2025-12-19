import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { collection, query, getDocs, setDoc, doc, onSnapshot, orderBy, limit, updateDoc, where, runTransaction, getDoc } from 'firebase/firestore';
// Fix: Import firebase compat to resolve "no exported member" for App/Auth functions
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { db, firebaseConfig } from '../firebase'; 
import { UserProfile, Task, AppNotification, Assessment } from '../types';
import { ContributionGraph } from '../components/ContributionGraph';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { ProfileModal } from '../components/ProfileModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { 
  LogOut, Moon, Sun, ShieldCheck, Search, 
  User as UserIcon, XCircle, TrendingUp, 
  Users, CheckCircle2, LayoutDashboard, AlertCircle, 
  RefreshCcw, ShieldAlert, Bell, Filter, 
  ListTodo, Activity, FileSpreadsheet, ChevronLeft, ChevronRight, X, UserPlus, Download,
  Eye, EyeOff, Clock, Sparkles, BarChart3, Calendar, Check, FileDown, Info, BrainCircuit, Target,
  Hash
} from 'lucide-react';
import { subDays, format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDate, isPast, startOfDay, isToday, startOfWeek, endOfWeek, formatDistanceToNow } from 'date-fns';

// --- Types for Admin Specific Features ---
type SortOption = 'name' | 'consistency' | 'overdue' | 'completion';
type TabView = 'overview' | 'tasks' | 'students';
type ChartRange = 'week' | 'month';
type StudentFilterType = 'all' | 'active' | 'pending';

// --- Constants ---
const ITEMS_PER_PAGE = 10;
const INSPECTION_ITEMS_PER_PAGE = 5;

// --- Helper: Safe Date Formatting ---
const safeFormat = (dateInput: number | Date | undefined, formatStr: string) => {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';
  return format(date, formatStr);
};

// --- Sub-Component: Performance Line Chart ---
const PerformanceLineChart = ({ tasks, label = "Performance", range = 'month', color = "#3b82f6" }: { tasks: Task[], label?: string, range: ChartRange, color?: string }) => {
  const today = new Date();
  let start: Date, end: Date;

  if (range === 'week') {
    // Start from the first day of the week (Sunday)
    start = startOfWeek(today, { weekStartsOn: 0 });
    end = endOfWeek(today, { weekStartsOn: 0 });
  } else {
    start = startOfMonth(today);
    end = endOfMonth(today);
  }

  const daysInInterval = eachDayOfInterval({ start, end });

  // Process Data
  const dataPoints = daysInInterval.map(day => {
    const completedCount = tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      const d = new Date(t.completedAt);
      return !isNaN(d.getTime()) && isSameDay(d, day);
    }).length;
    
    // For weekly view, show Day Name (Mon), for monthly show Date (1, 2)
    const displayLabel = range === 'week' ? format(day, 'EEE') : getDate(day).toString();
    
    return { day: displayLabel, count: completedCount, fullDate: day };
  });

  const maxVal = Math.max(...dataPoints.map(d => d.count), 5); // Minimum ceiling of 5

  // Generate Path
  const points = dataPoints.map((d, index) => {
    const x = (index / (dataPoints.length - 1)) * 100;
    const y = 100 - (d.count / maxVal) * 100;
    return `${x},${y}`;
  }).join(' ');

  const fillPath = `M 0,100 ${points} L 100,100 Z`;

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
          <TrendingUp className="w-4 h-4" style={{ color }} />
          {label}
        </h4>
        <div className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded">
          Range: {range === 'week' ? 'This Week' : format(today, 'MMMM')}
        </div>
      </div>
      
      <div className="relative w-full h-[150px] group">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
             <div key={tick} className="w-full border-t border-slate-100 dark:border-slate-700/50 h-0" />
          ))}
        </div>

        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`chartGradient-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#chartGradient-${label})`} className="transition-all duration-300" />
          <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md" />
          {dataPoints.map((d, index) => {
             const x = (index / (dataPoints.length - 1)) * 100;
             const y = 100 - (d.count / maxVal) * 100;
             return (
               <g key={index} className="group/point">
                 <circle cx={x} cy={y} r="2" className="fill-white stroke-2 opacity-0 group-hover/point:opacity-100 transition-opacity cursor-pointer z-10" style={{ stroke: color }} />
                 
                 {/* Tooltip */}
                 <foreignObject x={x - 15} y={y - 35} width="30" height="30" className="opacity-0 group-hover/point:opacity-100 transition-opacity overflow-visible pointer-events-none">
                    <div className="flex flex-col items-center">
                       <div className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap mb-1">
                          {d.count} tasks
                       </div>
                    </div>
                 </foreignObject>
               </g>
             );
          })}
        </svg>
        
        {/* X-Axis Labels - UPDATED to show all days when in month view */}
        <div className="flex justify-between mt-2 px-1 gap-px">
           {dataPoints.map((d, i) => (
              <span key={i} className="text-[7px] sm:text-[9px] text-slate-400 flex-1 text-center leading-none">
                {d.day}
              </span>
           ))}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Stats Card ---
const StatsCard = ({ label, value, icon: Icon, color, subValue }: any) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-start relative overflow-hidden transition-all hover:shadow-md">
    <div className={`p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 mb-3`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="relative z-10">
      <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">{label}</p>
      {subValue && (
        <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{subValue}</p>
      )}
    </div>
    {/* Decorative BG Icon */}
    <Icon className={`absolute -right-4 -bottom-4 w-24 h-24 ${color} opacity-5 transform rotate-12 pointer-events-none`} />
  </div>
);

export default function AdminDashboard() {
  const { user, userProfile, logout, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  
  // Data State
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentAssessment, setStudentAssessment] = useState<Assessment | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Pagination State
  const [studentPage, setStudentPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [inspectionPage, setInspectionPage] = useState(1);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null); // Ref for click outside
  
  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Add User State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const [createUserSuccess, setCreateUserSuccess] = useState('');
  const [projectedId, setProjectedId] = useState('Loading...');
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilterType>('all');
  
  // Chart State
  const [chartRange, setChartRange] = useState<ChartRange>('month');
  const [studentChartRange, setStudentChartRange] = useState<ChartRange>('month');

  // Get Name
  const firstName = userProfile?.displayName?.split(' ')[0] || 'Admin';

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Assessment when a student is selected
  useEffect(() => {
    if (!selectedStudent) {
        setStudentAssessment(null);
        setInspectionPage(1); // Reset pagination
        return;
    }
    
    // Only fetch if they have completed it (optimization) or just try fetching
    const fetchAssessment = async () => {
        try {
            const q = query(collection(db, 'assessments'), where('userId', '==', selectedStudent.uid), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setStudentAssessment({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Assessment);
            } else {
                setStudentAssessment(null);
            }
        } catch (e) {
            console.error("Failed to fetch assessment", e);
        }
    };
    fetchAssessment();
  }, [selectedStudent]);

  // Click Outside to Close Notifications
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationRef]);

  // Real-time notifications listener
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      orderBy('createdAt', 'desc'), 
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(fetched);
    });

    return () => unsubscribe();
  }, []);

  // Fetch projected ID when opening Add User modal
  useEffect(() => {
    if (showAddUserModal) {
      fetchProjectedId();
    }
  }, [showAddUserModal]);

  // Reset pagination when search/filter changes
  useEffect(() => {
    setStudentPage(1);
  }, [searchQuery, studentFilter]);

  useEffect(() => {
    setTaskPage(1);
  }, [searchQuery]);

  const fetchProjectedId = async () => {
    try {
      setProjectedId("Loading...");
      const docRef = doc(db, 'system', 'counters');
      const docSnap = await getDoc(docRef);
      let currentCount = 0;
      if (docSnap.exists()) {
        currentCount = docSnap.data().studentCount || 0;
      }
      const nextCount = currentCount + 1;
      setProjectedId(`DSV${nextCount.toString().padStart(4, '0')}`);
    } catch (e) {
      console.error("Failed to fetch projected ID", e);
      setProjectedId("DSV????");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch All Users
      const usersQ = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQ);
      const allUsers = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
      
      // Sort by newest registered first
      allUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      setStudents(allUsers); 

      // Fetch All Tasks
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setAllTasks(tasks);

    } catch (err: any) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        read: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    unread.forEach(n => markAsRead(n.id));
  };

  const getStudentName = (uid: string) => {
    const s = students.find(st => st.uid === uid);
    return s ? s.displayName : 'Unknown User';
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError('');
    setCreateUserSuccess('');

    if (!isValidEmail(newUserEmail)) {
      setCreateUserError("Please enter a valid email address.");
      return;
    }

    if (newUserPassword.length < 6) {
      setCreateUserError("Password must be at least 6 characters.");
      return;
    }

    setIsCreatingUser(true);

    let secondaryApp: firebase.app.App;
    try {
      // Generate unique Student ID atomically
      const studentId = await runTransaction(db, async (transaction) => {
         const counterRef = doc(db, 'system', 'counters');
         const counterDoc = await transaction.get(counterRef);
         
         let newCount = 1;
         if (counterDoc.exists()) {
             newCount = (counterDoc.data().studentCount || 0) + 1;
         }
         
         // Update the counter
         transaction.set(counterRef, { studentCount: newCount }, { merge: true });
         
         return `DSV${newCount.toString().padStart(4, '0')}`;
      });

      // Initialize secondary app to create user without logging out admin
      // Fix: Use firebase.initializeApp and firebase.apps for compat API
      const appName = "SecondaryApp";
      secondaryApp = firebase.apps.find(a => a.name === appName) || firebase.initializeApp(firebaseConfig, appName);
      
      const secondaryAuth = secondaryApp.auth();
      const userCredential = await secondaryAuth.createUserWithEmailAndPassword(newUserEmail, newUserPassword);
      const newUser = userCredential.user!;
      
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: newUserEmail,
        displayName: newUserName,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.uid}`,
        role: newUserRole,
        studentId: newUserRole === 'STUDENT' ? studentId : undefined,
        bio: newUserRole === 'ADMIN' ? 'Administrator' : 'Student',
        createdAt: Date.now(),
        requiresPasswordChange: true 
      });
      
      await secondaryAuth.signOut();
      
      setCreateUserSuccess(`New ${newUserRole.toLowerCase()} account created successfully! ID: ${studentId}`);
      
      // Reset Form
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('STUDENT');
      
      await fetchData();
      
      setTimeout(() => {
        setShowAddUserModal(false);
        setCreateUserSuccess('');
      }, 3000);
      
    } catch (error: any) {
      console.error("Error creating user:", error);
      let errMsg = error.message;
      if (errMsg.includes('email-already-in-use')) errMsg = "That email is already registered.";
      setCreateUserError(errMsg);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleExportCSV = (type: StudentFilterType) => {
     const headers = ["ID,Name,Email,Role,Joined Date,Total Tasks,Completed Tasks,Pending Tasks,Overdue Tasks,Completion Rate (%)"];
     
     let filteredData = students.filter(s => s.role === 'STUDENT');

     // Apply Filter
     if (type === 'active') {
       filteredData = filteredData.filter(s => !s.requiresPasswordChange);
     } else if (type === 'pending') {
       filteredData = filteredData.filter(s => s.requiresPasswordChange);
     }
     
     const rows = filteredData.map(s => {
        const sTasks = allTasks.filter(t => t.userId === s.uid);
        const total = sTasks.length;
        const completed = sTasks.filter(t => t.completed).length;
        // Approx overdue: past due date, not completed, not today
        const overdue = sTasks.filter(t => {
            const d = new Date(t.dueDate);
            return !isNaN(d.getTime()) && !t.completed && isPast(startOfDay(d)) && !isToday(d);
        }).length;
        
        const pending = total - completed;
        const rate = total ? Math.round((completed/total)*100) : 0;
        
        const joinedDate = safeFormat(s.createdAt, 'yyyy-MM-dd');
        
        return `"${s.studentId || ''}","${s.displayName}","${s.email}","${s.role}","${joinedDate}",${total},${completed},${pending},${overdue},${rate}`;
     });
     
     const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     const suffix = type === 'all' ? 'full' : type;
     link.setAttribute("download", `student_report_${suffix}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);

     setShowExportModal(false);
  };

  // Filter Students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (student.studentId || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (studentFilter === 'active') {
        matchesStatus = !student.requiresPasswordChange;
      } else if (studentFilter === 'pending') {
        matchesStatus = !!student.requiresPasswordChange;
      }
      
      return matchesSearch && matchesStatus;
    });
  }, [students, searchQuery, studentFilter]);
  
  // Paginated Students
  const paginatedStudents = useMemo(() => {
    const startIndex = (studentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, studentPage]);
  
  const totalStudentPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

  // Filter Tasks - UPDATED: Sort by createdAt descending
  const filteredTasks = useMemo(() => {
    return allTasks
      .filter(task => {
          const studentName = getStudentName(task.userId).toLowerCase();
          const taskTitle = task.title.toLowerCase();
          const query = searchQuery.toLowerCase();
          return studentName.includes(query) || taskTitle.includes(query);
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allTasks, searchQuery, students]);

  // Paginated Tasks
  const paginatedTasks = useMemo(() => {
    const startIndex = (taskPage - 1) * ITEMS_PER_PAGE;
    return filteredTasks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTasks, taskPage]);

  const totalTaskPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);

  const handleTabChange = (tab: TabView) => {
    setActiveTab(tab);
    setSearchQuery('');
    setStudentFilter('all');
  };

  // Selected Student Logic - UPDATED: Sort completed history by recent first
  const selectedStudentTasks = useMemo(() => {
    if (!selectedStudent) return [];
    return allTasks
      .filter(t => t.userId === selectedStudent.uid)
      .sort((a, b) => {
        // If both completed, show more recent completion at top
        if (a.completed && b.completed) {
          return (b.completedAt || 0) - (a.completedAt || 0);
        }
        // If only one is completed, put completed at the end of the combined view?
        // Usually, in a "History" context, we want to see what was just done.
        // Let's sort completed vs active, putting active first then history recent-first.
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        // If both active, sort by due date ascending
        return a.dueDate - b.dueDate;
      });
  }, [allTasks, selectedStudent]);
  
  // Paginated Inspection Tasks
  const paginatedInspectionTasks = useMemo(() => {
    const startIndex = (inspectionPage - 1) * INSPECTION_ITEMS_PER_PAGE;
    return selectedStudentTasks.slice(startIndex, startIndex + INSPECTION_ITEMS_PER_PAGE);
  }, [selectedStudentTasks, inspectionPage]);
  
  const totalInspectionPages = Math.ceil(selectedStudentTasks.length / INSPECTION_ITEMS_PER_PAGE);

  // System Wide Stats
  const systemTotalTasks = allTasks.length;
  const systemCompletedTasks = allTasks.filter(t => t.completed).length;
  const systemOverdueTasks = allTasks.filter(t => {
      const d = new Date(t.dueDate);
      return !isNaN(d.getTime()) && !t.completed && isPast(startOfDay(d)) && !isToday(d);
  }).length;
  const systemCompletionRate = systemTotalTasks ? Math.round((systemCompletedTasks / systemTotalTasks) * 100) : 0;
  
  // Notification Count
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 font-sans flex flex-col">
      {/* --- Navbar --- */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-brand-600 dark:bg-white text-white dark:text-brand-600 p-1.5 rounded-lg shadow-sm">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Admin Portal</span>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Notifications */}
               <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all relative"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                    )}
                  </button>
                  
                  {/* Notification Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                        <span className="font-bold text-xs uppercase text-slate-500 dark:text-slate-400">Notifications</span>
                        <div className="flex items-center gap-3">
                           {unreadCount > 0 && (
                             <button onClick={markAllRead} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                               Mark all read
                             </button>
                           )}
                           <button 
                                onClick={() => setShowNotifications(false)} 
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-sm">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map(notif => (
                            <div 
                              key={notif.id} 
                              onClick={() => markAsRead(notif.id)}
                              className={`p-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                <div className="flex-1">
                                  <p className={`text-sm ${!notif.read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
               </div>

               <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

               <button onClick={toggleTheme} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
                 {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
               </button>
               <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                  <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 group">
                    <div className="relative">
                      <img 
                        src={userProfile?.photoURL} 
                        alt="User" 
                        className="w-8 h-8 rounded-full bg-slate-200 border border-slate-200 dark:border-slate-700 object-cover" 
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block group-hover:text-brand-600 transition-colors">
                      {userProfile?.displayName}
                    </span>
                  </button>
                  <button onClick={() => setLogoutModalOpen(true)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
               </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* --- Header & Actions --- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Hello, {firstName}! 👋</h1>
             <p className="text-slate-500 dark:text-slate-400 mt-1">Here's the system overview for today.</p>
           </div>
           <div className="flex items-center gap-3">
              <Button onClick={() => setShowExportModal(true)} variant="secondary" className="gap-2 flex">
                 <Download className="w-4 h-4" /> Export Report
              </Button>
              <Button onClick={() => setShowAddUserModal(true)} className="shadow-lg shadow-brand-500/20 gap-2">
                <UserPlus className="w-4 h-4" /> User Management
              </Button>
           </div>
        </div>

        {/* --- Navigation Tabs --- */}
        <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6 overflow-x-auto">
          <button 
            onClick={() => handleTabChange('overview')}
            className={`pb-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === 'overview' ? 'border-brand-600 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => handleTabChange('students')}
            className={`pb-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === 'students' ? 'border-brand-600 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Student Directory
          </button>
          <button 
            onClick={() => handleTabChange('tasks')}
            className={`pb-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === 'tasks' ? 'border-brand-600 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Task Explorer
          </button>
        </div>

        {/* --- Tab Content: OVERVIEW --- */}
        {activeTab === 'overview' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard 
                  label="Total Students" 
                  value={students.filter(s => s.role === 'STUDENT').length} 
                  icon={Users} 
                  color="text-blue-500"
                  subValue={`${students.filter(s => s.requiresPasswordChange).length} pending activation`}
                />
                <StatsCard 
                  label="Completion Rate" 
                  value={`${systemCompletionRate}%`} 
                  icon={Activity} 
                  color="text-emerald-500"
                  subValue={`${systemCompletedTasks} / ${systemTotalTasks} tasks done`}
                />
                <StatsCard 
                  label="Overdue Tasks" 
                  value={systemOverdueTasks} 
                  icon={AlertCircle} 
                  color="text-red-500"
                  subValue="System-wide alerts"
                />
                <StatsCard 
                  label="Active Tasks" 
                  value={allTasks.filter(t => !t.completed).length} 
                  icon={ListTodo} 
                  color="text-amber-500"
                  subValue="Pending completion"
                />
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                   <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
                      <h3 className="font-bold text-slate-800 dark:text-white">System Performance</h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setChartRange('week')}
                          className={`text-xs font-bold px-2 py-1 rounded transition-colors ${chartRange === 'week' ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Week
                        </button>
                        <button 
                          onClick={() => setChartRange('month')}
                          className={`text-xs font-bold px-2 py-1 rounded transition-colors ${chartRange === 'month' ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Month
                        </button>
                      </div>
                   </div>
                   <PerformanceLineChart tasks={allTasks} range={chartRange} />
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-0 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white">Recent Activity</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[300px] p-4 space-y-4 custom-scrollbar">
                     {allTasks.sort((a,b) => b.createdAt - a.createdAt).slice(0, 8).map(task => (
                        <div key={task.id} className="flex items-start gap-3 text-sm">
                          <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${task.completed ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <div className="flex-1 min-w-0">
                             <p className="truncate text-slate-700 dark:text-slate-200 font-medium">{task.title}</p>
                             <p className="text-xs text-slate-400 flex justify-between">
                               <span>{getStudentName(task.userId)}</span>
                               <span>{safeFormat(task.createdAt, 'MMM d')}</span>
                             </p>
                          </div>
                        </div>
                     ))}
                     {allTasks.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No recent activity.</p>}
                  </div>
                </div>
             </div>
           </div>
        )}

        {/* --- Tab Content: GLOBAL TASK EXPLORER --- */}
        {activeTab === 'tasks' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/30 dark:bg-slate-800">
               <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search by task title or student name..." 
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               
               <div className="flex items-center gap-3">
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {filteredTasks.length} Found
                 </span>
               </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                 <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                       <th className="px-6 py-4">Task Details</th>
                       <th className="px-6 py-4">Assigned To</th>
                       <th className="px-6 py-4">Due Date</th>
                       <th className="px-6 py-4">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {paginatedTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                           <td className="px-6 py-4 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                             {task.title}
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
                                   {getStudentName(task.userId).charAt(0)}
                                </div>
                                <span className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium">
                                  {getStudentName(task.userId)}
                                </span>
                             </div>
                           </td>
                           <td className="px-6 py-4 text-slate-500">
                              {safeFormat(task.dueDate, 'MMM d, yyyy')}
                           </td>
                           <td className="px-6 py-4">
                              {task.completed ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Done
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${(() => {
                                    const d = new Date(task.dueDate);
                                    return !isNaN(d.getTime()) && isPast(startOfDay(d)) && !isToday(d) ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
                                })()}`}>
                                  Pending
                                </span>
                              )}
                           </td>
                        </tr>
                    ))}
                 </tbody>
              </table>
              {filteredTasks.length === 0 && (
                 <div className="p-8 text-center text-slate-500">No tasks found.</div>
              )}
            </div>
            
            {/* Pagination */}
            <Pagination 
              currentPage={taskPage}
              totalPages={totalTaskPages}
              onPageChange={setTaskPage}
            />
          </div>
        )}

        {/* --- Tab Content: STUDENT DIRECTORY --- */}
        {activeTab === 'students' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/30 dark:bg-slate-800">
               <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search students by name or email..." 
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               
               <div className="flex items-center gap-3">
                 <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-sm">
                   <Filter className="w-4 h-4 text-slate-400" />
                   <span className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap hidden sm:inline">Filter:</span>
                   <select 
                      value={studentFilter}
                      onChange={(e) => setStudentFilter(e.target.value as StudentFilterType)}
                      className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 dark:text-white font-medium cursor-pointer focus:outline-none"
                   >
                     <option value="all" className="text-slate-900 dark:text-slate-900">All Students</option>
                     <option value="active" className="text-slate-900 dark:text-slate-900">Active Students Only</option>
                     <option value="pending" className="text-slate-900 dark:text-slate-900">Pending Activation</option>
                   </select>
                 </div>
               </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                 <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                       <th className="px-6 py-4">User Identity</th>
                       <th className="px-6 py-4">Role</th>
                       <th className="px-6 py-4">Account Status</th>
                       <th className="px-6 py-4">Joined</th>
                       <th className="px-6 py-4 text-right">Inspection</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {paginatedStudents.length > 0 ? (
                      paginatedStudents.map((student) => (
                        <tr 
                          key={student.uid} 
                          onClick={() => setSelectedStudent(student)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        >
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                                <img src={student.photoURL} alt="" className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700 object-cover" />
                                <div>
                                   <div className="flex items-center gap-2">
                                     <p className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{student.displayName}</p>
                                     {student.assessmentCompleted && (
                                       <div className="bg-brand-50 dark:bg-brand-900/20 p-0.5 rounded-full" title="Assessment Completed">
                                         <BrainCircuit className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                                       </div>
                                     )}
                                   </div>
                                   <div className="flex items-center gap-2">
                                     <p className="text-xs text-slate-500">{student.email}</p>
                                     {student.studentId && (
                                       <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                         {student.studentId}
                                       </span>
                                     )}
                                   </div>
                                </div>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${student.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                                {student.role}
                              </span>
                           </td>
                           <td className="px-6 py-4">
                             {student.requiresPasswordChange ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
                                   <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                   Pending
                                </span>
                             ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  Active
                                </span>
                             )}
                           </td>
                           <td className="px-6 py-4 text-slate-500">
                              {safeFormat(student.createdAt, 'MMM d, yyyy')}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); }}>
                                View Details
                              </Button>
                           </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                           <div className="flex flex-col items-center gap-2">
                             <Search className="w-8 h-8 opacity-20" />
                             <p>No students found matching your filters.</p>
                           </div>
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination 
              currentPage={studentPage}
              totalPages={totalStudentPages}
              onPageChange={setStudentPage}
            />
          </div>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Study Tracker. Powered by Dream Stars <span className="text-amber-500 font-bold">VIP</span>
          </p>
        </div>
      </footer>

      {/* --- Student Inspection Modal --- */}
      {selectedStudent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedStudent(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative bg-slate-100 dark:bg-slate-800 p-6 flex items-start justify-between border-b border-slate-200 dark:border-slate-700">
               <div className="flex items-center gap-4 z-10">
                  <img src={selectedStudent.photoURL} className="w-16 h-16 rounded-full border-4 border-white dark:border-slate-700 shadow-md bg-white" alt="Profile" />
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedStudent.displayName}
                      {selectedStudent.role === 'ADMIN' && <ShieldCheck className="w-5 h-5 text-purple-500" />}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 text-sm">
                      <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{selectedStudent.role}</span>
                      <span>{selectedStudent.email}</span>
                      {selectedStudent.studentId && (
                        <span className="font-mono bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 px-2 py-0.5 rounded text-xs font-bold">
                          {selectedStudent.studentId}
                        </span>
                      )}
                      {selectedStudent.assessmentCompleted && (
                          <span className="text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-900/30 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1">
                             <BrainCircuit className="w-3 h-3" /> Assessed
                          </span>
                      )}
                    </p>
                  </div>
               </div>
               <button onClick={() => setSelectedStudent(null)} className="p-2 bg-white dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors shadow-sm z-10">
                 <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
               </button>
               
               {/* Background Pattern */}
               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-slate-900/50">
               <div className="p-6 space-y-6">
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 text-xs font-bold uppercase">Tasks</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedStudentTasks.length}</p>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 text-xs font-bold uppercase">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{selectedStudentTasks.filter(t => t.completed).length}</p>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 text-xs font-bold uppercase">Pending</p>
                        <p className="text-2xl font-bold text-amber-600">{selectedStudentTasks.filter(t => !t.completed).length}</p>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 text-xs font-bold uppercase">Rate</p>
                        <p className="text-2xl font-bold text-brand-600">
                          {selectedStudentTasks.length ? Math.round((selectedStudentTasks.filter(t => t.completed).length / selectedStudentTasks.length) * 100) : 0}%
                        </p>
                     </div>
                  </div>

                  {/* --- ASSESSMENT SECTION --- */}
                  {studentAssessment ? (
                      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 flex items-center justify-between">
                             <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-purple-500" /> Educational Assessment Results
                             </h3>
                             <span className="text-xs text-slate-400">Submitted {safeFormat(studentAssessment.submittedAt, 'MMM d, yyyy')}</span>
                          </div>
                          
                          <div className="p-6">
                            {studentAssessment.responses ? (
                                // New Dynamic Format - Vertically Stacked
                                <div className="space-y-10">
                                    {/* Study Habits */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-100 dark:border-slate-700">
                                        <h4 className="font-bold text-base text-slate-800 dark:text-white uppercase tracking-wide mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                                            <Clock className="w-5 h-5 text-brand-600" /> Study Habits Analysis
                                        </h4>
                                        <div className="grid grid-cols-1 gap-6">
                                            {studentAssessment.responses.filter(r => r.category === 'Study Habits').map((r, i) => (
                                                <div key={i} className="text-sm bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                        <div className="flex gap-3">
                                                            <span className="text-slate-400 font-bold text-xs mt-0.5">Q{i+1}</span>
                                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{r.question}</p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                                                                r.answer === 'Yes Consistently' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900' :
                                                                r.answer === 'Often' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900' :
                                                                'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                            }`}>
                                                                {r.answer}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Personality Traits */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-100 dark:border-slate-700">
                                        <h4 className="font-bold text-base text-slate-800 dark:text-white uppercase tracking-wide mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                                            <Target className="w-5 h-5 text-purple-600" /> Personality Profile
                                        </h4>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {studentAssessment.responses.filter(r => r.category === 'Personality').map((r, i) => (
                                                <div key={i} className="text-sm bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                                                    <div className="mb-3">
                                                      <div className="flex items-center justify-between mb-2">
                                                        {r.label && (
                                                            <span className="inline-block text-[10px] font-bold uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                                                            {r.label}
                                                            </span>
                                                        )}
                                                      </div>
                                                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-xs">
                                                        {r.question}
                                                      </p>
                                                    </div>
                                                    <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Response</span>
                                                        <span className={`font-bold ${
                                                            r.answer === 'Yes Consistently' ? 'text-purple-600 dark:text-purple-400' :
                                                            r.answer === 'Often' ? 'text-blue-600 dark:text-blue-400' :
                                                            'text-slate-500'
                                                        }`}>
                                                            {r.answer}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Backward Compatibility for Old Format
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> Study Habits
                                        </h4>
                                        <ul className="space-y-3 text-sm">
                                            <li className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                                <span className="text-slate-500">Daily Hours:</span>
                                                <span className="font-medium dark:text-white">{studentAssessment.studyHabits?.averageHours} hrs</span>
                                            </li>
                                            <li className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                                <span className="text-slate-500">Preferred Time:</span>
                                                <span className="font-medium dark:text-white">{studentAssessment.studyHabits?.preferredTime}</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                            <Target className="w-4 h-4" /> Personality
                                        </h4>
                                        <ul className="space-y-3 text-sm">
                                            <li className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                                <span className="text-slate-500">Type:</span>
                                                <span className="font-medium dark:text-white">{studentAssessment.personality?.type}</span>
                                            </li>
                                            <li className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                                <span className="text-slate-500">Learning Style:</span>
                                                <span className="font-medium dark:text-white">{studentAssessment.personality?.learningStyle}</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                          </div>
                      </div>
                  ) : (
                      <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
                          <BrainCircuit className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-slate-500 text-sm">No educational assessment submitted yet.</p>
                      </div>
                  )}

                  {/* Graphs */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ContributionGraph tasks={selectedStudentTasks} className="h-full" />
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                       <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
                          <h3 className="font-bold text-slate-800 dark:text-white">Activity Trend</h3>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setStudentChartRange('week')}
                              className={`text-xs font-bold px-2 py-1 rounded transition-colors ${studentChartRange === 'week' ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Week
                            </button>
                            <button 
                              onClick={() => setStudentChartRange('month')}
                              className={`text-xs font-bold px-2 py-1 rounded transition-colors ${studentChartRange === 'month' ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Month
                            </button>
                          </div>
                       </div>
                       <PerformanceLineChart tasks={selectedStudentTasks} range={studentChartRange} label="Student Activity" color="#10b981" />
                    </div>
                  </div>

                  {/* Task List - NOW SHOWING RECENT COMPLETIONS AT TOP */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                     <div className="p-4 border-b border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <ListTodo className="w-5 h-5 text-slate-400" />
                            Task History
                        </div>
                        <span className="text-xs font-normal text-slate-400">
                            {selectedStudentTasks.length} Total
                        </span>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase sticky top-0">
                              <tr>
                                 <th className="px-6 py-3">Title</th>
                                 <th className="px-6 py-3">Due Date</th>
                                 <th className="px-6 py-3">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {paginatedInspectionTasks.map(task => (
                                 <tr key={task.id}>
                                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white truncate max-w-xs">{task.title}</td>
                                    <td className="px-6 py-3 text-slate-500">{safeFormat(task.dueDate, 'MMM d, yyyy')}</td>
                                    <td className="px-6 py-3">
                                       {task.completed ? (
                                          <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                                             <CheckCircle2 className="w-3 h-3" /> Done
                                          </span>
                                       ) : (
                                          <span className="text-slate-400 text-xs font-medium">Pending</span>
                                       )}
                                    </td>
                                 </tr>
                              ))}
                              {selectedStudentTasks.length === 0 && (
                                 <tr><td colSpan={3} className="p-6 text-center text-slate-400">No tasks recorded for this student.</td></tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                     <Pagination 
                        currentPage={inspectionPage}
                        totalPages={totalInspectionPages}
                        onPageChange={setInspectionPage}
                     />
                  </div>
               </div>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
               <Button onClick={() => setSelectedStudent(null)}>Close Inspection</Button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add User Modal --- */}
      {showAddUserModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddUserModal(false)}
        >
           <div 
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
           >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                 <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                   <UserPlus className="w-5 h-5 text-brand-600" /> Create New User
                 </h3>
                 <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              
              <form onSubmit={handleCreateUser} className="p-6 space-y-5" autoComplete="off">
                 {createUserSuccess ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 p-4 rounded-lg flex items-start gap-3">
                       <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                       <div className="text-sm">{createUserSuccess}</div>
                    </div>
                 ) : (
                   <>
                     {createUserError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                           {createUserError}
                        </div>
                     )}
                     
                     <div className="space-y-4">
                        {/* Student ID Display (Disabled) */}
                        {newUserRole === 'STUDENT' && (
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                             <div className="flex items-center gap-2 text-slate-500">
                                <Hash className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Student ID</span>
                             </div>
                             <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                {projectedId}
                             </span>
                          </div>
                        )}

                        <Input 
                          label="Full Name" 
                          placeholder="e.g. John Doe"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          required
                        />
                        
                        <Input 
                          label="Email Address" 
                          type="email"
                          placeholder="user@example.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          required
                          autoComplete="new-password"
                        />
                        
                        <div>
                           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                           <select 
                              value={newUserRole}
                              onChange={(e) => setNewUserRole(e.target.value as 'STUDENT' | 'ADMIN')}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                           >
                              <option value="STUDENT">Student</option>
                              <option value="ADMIN">Administrator</option>
                           </select>
                           <p className="text-xs text-slate-500 mt-1">
                              {newUserRole === 'ADMIN' ? 'Has full access to dashboard & user management.' : 'Limited access to personal task tracking.'}
                           </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Temporary Password</label>
                          <div className="relative">
                              <Input 
                                type={showNewUserPassword ? "text" : "password"}
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                required
                                placeholder="Set a temporary password"
                                className="pr-10"
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                              >
                                {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              User will be required to change this upon first login.
                          </p>
                        </div>
                     </div>

                     <div className="pt-2 flex gap-3">
                        <Button type="button" variant="secondary" onClick={() => setShowAddUserModal(false)} className="flex-1">
                          Cancel
                        </Button>
                        <Button type="submit" isLoading={isCreatingUser} className="flex-1">
                          Create Account
                        </Button>
                     </div>
                   </>
                 )}
              </form>
           </div>
        </div>
      )}

      {/* Export Options Modal */}
      {showExportModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowExportModal(false)}
        >
           <div 
             className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="p-6 text-center">
                 <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-4 shadow-sm bg-brand-100 dark:bg-brand-900/30">
                    <FileDown className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Export Data</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-2 mb-6">
                   Select the type of student data you would like to download as a CSV report.
                 </p>
                 
                 <div className="space-y-3">
                    <button 
                      onClick={() => handleExportCSV('all')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all group"
                    >
                       <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400">All Students</span>
                       <Download className="w-4 h-4 text-slate-400 group-hover:text-brand-500" />
                    </button>
                    
                    <button 
                      onClick={() => handleExportCSV('active')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                    >
                       <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-green-700 dark:group-hover:text-green-400">Active Only</span>
                       <Check className="w-4 h-4 text-slate-400 group-hover:text-green-500" />
                    </button>
                    
                    <button 
                      onClick={() => handleExportCSV('pending')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all group"
                    >
                       <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-700 dark:group-hover:text-amber-400">Pending Only</span>
                       <Clock className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                    </button>
                 </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-center border-t border-slate-100 dark:border-slate-700">
                <Button variant="secondary" onClick={() => setShowExportModal(false)} className="w-full">
                  Cancel
                </Button>
              </div>
           </div>
        </div>
      )}

      {/* Logout Modal */}
      <ConfirmationModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        title="Sign Out"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
      />

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
}
