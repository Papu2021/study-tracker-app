import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Task } from '../types';
import { ContributionGraph } from '../components/ContributionGraph';
import { ProfileModal } from '../components/ProfileModal';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  LogOut, Moon, Sun, Plus, CheckCircle2, Circle, 
  Trash2, Calendar, Layout, Clock, Pencil, X,
  Flag, Zap, Trophy, Target, Flame, Coffee, History
} from 'lucide-react';
import { format, isToday, isFuture, isPast, startOfDay, parseISO } from 'date-fns';

export default function StudentDashboard() {
  const { user, userProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Task Actions State
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  
  // Add Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [isAdding, setIsAdding] = useState(false);

  // Edit Task Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Get First Name for Greeting
  const firstName = userProfile?.displayName?.split(' ')[0] || 'Student';

  // Fetch Tasks
  useEffect(() => {
    if (!user) return;
    
    // Sort client-side
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Sort: Oldest to Newest based on creation time (no shuffle, no priority sort)
      fetchedTasks.sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return a.createdAt - b.createdAt;
        }
        return a.id.localeCompare(b.id);
      });
      setTasks(fetchedTasks);

      // --- CHECK FOR OVERDUE TASKS & NOTIFY ADMIN ---
      fetchedTasks.forEach(async (task) => {
        // If task is not completed, is overdue (before today's start), and we haven't notified admin yet
        const isOverdue = !task.completed && isPast(startOfDay(task.dueDate)) && !isToday(task.dueDate);
        
        if (isOverdue && !task.overdueNotificationSent) {
           try {
              // 1. Send Notification
              await addDoc(collection(db, 'notifications'), {
                type: 'warning',
                message: `${userProfile?.displayName || 'Student'} has an overdue task: '${task.title}'`,
                createdAt: Date.now(),
                read: false,
                studentId: user.uid
              });

              // 2. Mark task as notified (to prevent loops/duplicate notifs)
              await updateDoc(doc(db, 'tasks', task.id), {
                overdueNotificationSent: true
              });
           } catch (e) {
             console.error("Error sending overdue notification:", e);
           }
        }
      });

    }, (error) => {
      console.error("Error fetching tasks:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newTaskTitle.trim()) {
        alert("Please enter a task title");
        return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    setIsAdding(true);
    try {
      const dateObj = parseISO(newTaskDate);
      if (isNaN(dateObj.getTime())) {
          throw new Error("Invalid Date");
      }
      const timestamp = startOfDay(dateObj).getTime();

      await addDoc(collection(db, 'tasks'), {
        userId: user.uid,
        title: newTaskTitle.trim(),
        dueDate: timestamp,
        priority: newTaskPriority,
        completed: false,
        createdAt: Date.now(),
        overdueNotificationSent: false
      });
      setNewTaskTitle('');
      setNewTaskPriority('medium');
      setNewTaskDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error("Error adding task:", error);
      alert("Failed to add task. Please check your internet connection.");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      const newStatus = !task.completed;
      
      await updateDoc(doc(db, 'tasks', task.id), {
        completed: newStatus,
        completedAt: newStatus ? Date.now() : null
      });

      // Send Notification to Admin when completing a task
      if (newStatus) {
        await addDoc(collection(db, 'notifications'), {
          type: 'success',
          message: `${userProfile?.displayName || 'A student'} completed "${task.title}"`,
          createdAt: Date.now(),
          read: false,
          studentId: user?.uid
        });
      }

    } catch (error) {
      console.error(error);
    }
  };

  // --- Edit Logic ---
  const openEditModal = (task: Task) => {
    setTaskToEdit(task);
    setEditTitle(task.title);
    setEditPriority(task.priority || 'medium');
    
    // Safely format date for input
    const d = new Date(task.dueDate);
    const dateStr = !isNaN(d.getTime()) ? format(d, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setEditDate(dateStr);
    
    setEditModalOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskToEdit) return;

    if (!editTitle.trim()) {
      alert("Task title cannot be empty");
      return;
    }

    setIsSavingEdit(true);
    try {
      const dateObj = parseISO(editDate);
      if (isNaN(dateObj.getTime())) {
          throw new Error("Invalid Date");
      }
      const timestamp = startOfDay(dateObj).getTime();
      
      // Reset notification flag if due date is changed to future
      const isNowFuture = !isPast(timestamp) || isToday(timestamp);

      await updateDoc(doc(db, 'tasks', taskToEdit.id), {
        title: editTitle.trim(),
        dueDate: timestamp,
        priority: editPriority,
        overdueNotificationSent: isNowFuture ? false : taskToEdit.overdueNotificationSent
      });
      
      setEditModalOpen(false);
      setTaskToEdit(null);
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteModalOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskToDelete));
    } catch (error) {
      console.error(error);
    }
  };

  // --- Analysis Calculations ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const highPriorityPending = tasks.filter(t => !t.completed && t.priority === 'high').length;
  const tasksCompletedToday = tasks.filter(t => t.completed && t.completedAt && isToday(new Date(t.completedAt))).length;

  // --- UI Helpers ---
  const getPriorityBorder = (p?: string) => {
    switch(p) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-amber-500';
      case 'low': return 'border-l-blue-500';
      default: return 'border-l-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-brand-600 rounded-lg p-1.5 shadow-md shadow-brand-500/30">
                <Layout className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Study Tracker</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
               <button onClick={toggleTheme} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
                 {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
               </button>
               
               <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

               <div className="flex items-center gap-3">
                  <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1 pr-3 rounded-full transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                    <img 
                      src={userProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                      alt="User" 
                      className="w-8 h-8 rounded-full bg-slate-200 border border-slate-200 dark:border-slate-700 object-cover" 
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
                      {userProfile?.displayName || user?.email?.split('@')[0]}
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

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        
        {/* --- Greeting Section --- */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
             Hello, {firstName}! 👋
           </h1>
           <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
             Ready to focus? Here is your progress overview.
           </p>
        </div>

        {/* --- Analysis Section (Grid) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Card 1: Completion Rate */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden flex items-center justify-between group">
            <div className="relative z-10">
              <p className="text-emerald-50 text-xs font-bold uppercase tracking-wider mb-1">Total Progress</p>
              <h3 className="text-3xl font-bold">{completionRate}%</h3>
              <p className="text-xs text-emerald-100 mt-1 opacity-90 font-medium">{completedTasks} of {totalTasks} tasks done</p>
            </div>
            {/* Circular Progress Indicator */}
            <div className="relative w-16 h-16 flex items-center justify-center">
               <svg className="w-full h-full transform -rotate-90">
                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-emerald-800/30" />
                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175} strokeDashoffset={175 - (175 * completionRate) / 100} className="text-white transition-all duration-1000 ease-out" />
               </svg>
               <Target className="w-5 h-5 absolute text-white group-hover:scale-110 transition-transform" />
            </div>
            <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
          </div>

          {/* Card 2: High Priority Focus */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center relative overflow-hidden group">
             <div className="flex items-center gap-3 mb-2">
               <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                 <Flame className="w-5 h-5 text-red-600 dark:text-red-400" />
               </div>
               <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Focus Tasks</span>
             </div>
             <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{highPriorityPending}</h3>
                <span className="text-xs text-slate-400">high priority pending</span>
             </div>
             {highPriorityPending > 0 ? (
               <div className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 py-1 px-2 rounded-md inline-block w-max">
                 Action required
               </div>
             ) : (
                <div className="mt-3 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 py-1 px-2 rounded-md inline-block w-max">
                 All clear!
               </div>
             )}
          </div>

          {/* Card 3: Today's Wins */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center relative overflow-hidden group">
             <div className="flex items-center gap-3 mb-2">
               <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                 <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
               </div>
               <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Today's Wins</span>
             </div>
             <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{tasksCompletedToday}</h3>
                <span className="text-xs text-slate-400">completed today</span>
             </div>
             <div className="mt-3 w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(tasksCompletedToday * 20, 100)}%` }}
                ></div>
             </div>
          </div>
        </div>

        {/* --- Main 2-Row Layout for Desktop --- */}
        <div className="flex flex-col gap-8">
          
          {/* ROW 1: Add Task & Consistency */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left: Add Task (1/3) */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    Quick Add
                  </h3>
                </div>
                
                <form onSubmit={handleAddTask} className="p-5 space-y-4">
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">Title</label>
                      <Input 
                        placeholder="e.g. Math Chapter 4" 
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-brand-500 text-sm"
                      />
                  </div>
                  
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">Due Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                          type="date" 
                          value={newTaskDate}
                          onChange={(e) => setNewTaskDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white shadow-sm transition-all hover:border-brand-300 dark:hover:border-brand-700"
                        />
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">Priority</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: 'high', label: 'High', icon: Flame, color: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900' },
                          { id: 'medium', label: 'Med', icon: Zap, color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900' },
                          { id: 'low', label: 'Low', icon: Coffee, color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900' }
                        ].map((p) => {
                          const Icon = p.icon;
                          const isSelected = newTaskPriority === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setNewTaskPriority(p.id as any)}
                              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg border transition-all duration-200 ${
                                isSelected
                                ? `${p.color} ring-1 ring-offset-1 ring-slate-300 dark:ring-offset-slate-800 border-transparent shadow-sm scale-105 font-bold` 
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-50'}`} />
                              <span className="text-[10px]">{p.label}</span>
                            </button>
                          );
                        })}
                      </div>
                  </div>

                  <Button type="submit" isLoading={isAdding} className="w-full gap-2 mt-2 shadow-md shadow-brand-500/20 h-10">
                      <Plus className="w-4 h-4" /> Create
                  </Button>
                </form>
              </div>
            </div>

            {/* Right: Consistency Graph (2/3) */}
            <div className="lg:col-span-2 h-full">
               <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden h-full flex flex-col">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">Consistency</h3>
                  </div>
                  <div className="p-0 flex-1">
                    <ContributionGraph tasks={tasks} className="border-0 shadow-none rounded-none h-full" />
                  </div>
               </div>
            </div>

          </div>

          {/* ROW 2: Active Tasks & History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left: Active Tasks (2/3) */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[500px] flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Up Next
                  </h2>
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                      {tasks.filter(t => !t.completed).length} Tasks
                  </span>
                </div>
                
                <div className="p-6 flex-1 bg-slate-50/30 dark:bg-slate-900/20">
                  <div className="space-y-3">
                    {tasks.filter(t => !t.completed).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-75">
                        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">All caught up!</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
                          Great job clearing your list. Take a break or add new tasks to stay ahead.
                        </p>
                      </div>
                    ) : (
                      tasks.filter(t => !t.completed).map(task => (
                        <div 
                          key={task.id} 
                          className={`group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all border-l-4 ${getPriorityBorder(task.priority)} relative overflow-hidden`}
                        >
                          <div className="flex items-start gap-4 relative z-10">
                            <button 
                              onClick={() => toggleTask(task)}
                              className="mt-1 text-slate-300 hover:text-emerald-500 transition-colors"
                              title="Mark as completed"
                            >
                              <Circle className="w-6 h-6" />
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words pr-8">
                                  {task.title}
                                </h4>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0">
                                  <button onClick={() => openEditModal(task)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => confirmDelete(task.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    task.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                  {task.priority === 'high' && <Flame className="w-3 h-3" />}
                                  {task.priority === 'medium' && <Zap className="w-3 h-3" />}
                                  {task.priority === 'low' && <Coffee className="w-3 h-3" />}
                                  {task.priority || 'medium'}
                                </span>

                                <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                                  isPast(startOfDay(task.dueDate)) && !isToday(task.dueDate) 
                                    ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  {isToday(task.dueDate) ? 'Today' : format(task.dueDate, 'MMM d, yyyy')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: History (1/3) */}
            <div className="lg:col-span-1 sticky top-24">
              {tasks.some(t => t.completed) ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide flex items-center gap-2">
                      <History className="w-4 h-4" /> History
                    </h3>
                    <span className="text-xs text-slate-500">{tasks.filter(t => t.completed).length} Done</span>
                  </div>
                  <div className="p-4 max-h-[500px] overflow-y-auto space-y-2 custom-scrollbar">
                    {tasks.filter(t => t.completed).map(task => (
                        <div key={task.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 flex items-start gap-3 border border-slate-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                          <button onClick={() => toggleTask(task)} className="text-emerald-500 mt-0.5">
                              <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <div className="flex-1 min-w-0">
                              <span className="block text-slate-500 dark:text-slate-400 line-through text-sm font-medium leading-tight truncate">
                                  {task.title}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {task.completedAt ? format(task.completedAt, 'MMM d') : 'Done'}
                              </span>
                          </div>
                          <button onClick={() => confirmDelete(task.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center opacity-70">
                    <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No completed tasks yet.</p>
                </div>
              )}
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Study Tracker. Powered by Dream Stars <span className="text-amber-500 font-bold">VIP</span>
          </p>
        </div>
      </footer>

      {/* --- Edit Task Modal --- */}
      {editModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setEditModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
               <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                 <Pencil className="w-4 h-4 text-brand-600" /> Edit Task
               </h3>
               <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X className="w-5 h-5" />
               </button>
            </div>
            
            <form onSubmit={handleUpdateTask} className="p-6 space-y-4">
               <Input 
                 label="Task Title"
                 value={editTitle}
                 onChange={(e) => setEditTitle(e.target.value)}
                 className="bg-white dark:bg-slate-900"
               />
               
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                 <input 
                   type="date" 
                   value={editDate}
                   onChange={(e) => setEditDate(e.target.value)}
                   className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Priority</label>
                 <div className="flex gap-2">
                    {[
                      { id: 'high', label: 'High Priority' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'low', label: 'Low' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditPriority(p.id as any)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                          editPriority === p.id 
                          ? 'bg-brand-600 text-white border-brand-600 shadow-md' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                 </div>
               </div>

               <div className="pt-2 flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSavingEdit} className="flex-1 shadow-md">
                    Save Changes
                  </Button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Other Modals --- */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        isDestructive
      />
      
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