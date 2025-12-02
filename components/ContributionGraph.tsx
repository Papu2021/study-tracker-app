import React, { useMemo } from 'react';
import { Task } from '../types';
import { format, eachDayOfInterval, endOfMonth, startOfMonth, subMonths, addMonths, getDay } from 'date-fns';

interface ContributionGraphProps {
  tasks: Task[];
  className?: string;
}

export const ContributionGraph: React.FC<ContributionGraphProps> = ({ tasks, className = '' }) => {
  // 1. Generate months starting from the most recent December (Fixed Start Month)
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    
    // Find the anchor December:
    // If today is Dec, start from today.
    // If today is any other month, go back to the previous December.
    let startDate = startOfMonth(today);
    while (startDate.getMonth() !== 11) { // 11 = December
      startDate = subMonths(startDate, 1);
    }

    // Generate 12 months forward (Dec, Jan, Feb... Nov)
    for (let i = 0; i < 12; i++) {
      result.push(addMonths(startDate, i));
    }
    return result;
  }, []);

  // 2. Map tasks to dates for O(1) lookup
  const contributions = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(task => {
      // Track completed tasks for consistency stats
      if (task.completed && task.completedAt) {
        const d = new Date(task.completedAt);
        if (!isNaN(d.getTime())) {
          const dateKey = format(d, 'yyyy-MM-dd');
          map.set(dateKey, (map.get(dateKey) || 0) + 1);
        }
      }
    });
    return map;
  }, [tasks]);

  // Helper for Green Color Scale
  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-700/40'; 
    if (count === 1) return 'bg-green-200 dark:bg-green-900/80';
    if (count <= 3) return 'bg-green-400 dark:bg-green-600';
    if (count <= 5) return 'bg-green-500 dark:bg-green-500';
    return 'bg-green-600 dark:bg-green-400';
  };
  
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="text-green-500 text-xl">⚡</span>
          <span>Study or Task Consistency</span>
        </h3>
        
        {/* Legend - Visible on mobile now */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="w-3 h-3 bg-slate-100 dark:bg-slate-700/40 rounded-[2px]"></div>
          <div className="w-3 h-3 bg-green-200 dark:bg-green-900/80 rounded-[2px]"></div>
          <div className="w-3 h-3 bg-green-400 dark:bg-green-600 rounded-[2px]"></div>
          <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-[2px]"></div>
          <span>More</span>
        </div>
      </div>
      
      {/* Horizontal Scroll Container */}
      <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
        <div className="flex gap-8 min-w-max pb-2">
          {months.map((monthDate, monthIndex) => {
            const start = startOfMonth(monthDate);
            const end = endOfMonth(monthDate);
            const daysInMonth = eachDayOfInterval({ start, end });
            const startDay = getDay(start); 
            
            // Create array with empty slots for correct alignment
            // grid-flow-col fills top-to-bottom, then left-to-right
            const gridSlots = Array(startDay).fill(null).concat(daysInMonth);

            return (
              <div key={monthIndex} className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-1">
                  {format(monthDate, 'MMMM')}
                </span>
                
                <div className="flex gap-2">
                   {/* Day Names Vertical Column - Only show for the first month to reduce clutter */}
                   {monthIndex === 0 && (
                     <div className="grid grid-rows-7 gap-1.5 h-max pr-1">
                        {dayLabels.map((day, i) => (
                          <span key={i} className="text-[9px] text-slate-400 dark:text-slate-500 font-medium h-3.5 flex items-center justify-end leading-none">
                            {day}
                          </span>
                        ))}
                     </div>
                   )}

                   {/* Days Grid - Flow Column (Vertical Days) */}
                   <div className="grid grid-rows-7 grid-flow-col gap-1.5 auto-cols-min">
                      {gridSlots.map((day, i) => {
                        if (!day) return <div key={`empty-${i}`} className="w-3.5 h-3.5" />;
                        
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const count = contributions.get(dateKey) || 0;
                        
                        return (
                          <div
                            key={format(day, 'yyyy-MM-dd')}
                            title={`${count} tasks completed on ${format(day, 'MMM d')}`}
                            className={`
                              w-3.5 h-3.5 rounded-[2px] 
                              ${getColor(count)} 
                              transition-all duration-200 hover:scale-125 hover:z-10 cursor-default
                            `}
                          />
                        );
                      })}
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};