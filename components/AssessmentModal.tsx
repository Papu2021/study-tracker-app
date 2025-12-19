import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './ui/Button';
import { BrainCircuit, BookOpen, Target, X, CheckCircle2, ChevronRight, ChevronLeft, PartyPopper, Send } from 'lucide-react';
import { AssessmentResponse } from '../types';

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHOICES = ["No", "Often", "Yes Consistently"];

const STUDY_QUESTIONS = [
  "Do you often plan and organize your study sessions in advance and track your progress for the result?",
  "Do you use your own study strategies to read and understand the material?",
  "How often do you review your class notes or study materials before exams?",
  "Do you often find yourself unprepared for exams because you haven't completed your readings?",
  "Do you regularly feel that your scores or grades reflect your potential in the subject?",
  "Are you satisfied with your current academic performance compared to your peers?",
  "Do you often seek additional resources such as extra courses, books, or online websites or guidance from others to enhance your understanding?"
];

const PERSONALITY_QUESTIONS = [
  {
    label: "Procrastinator",
    text: "Do you often find yourself waiting until the last minute to start your tasks, study, or exam preparation even if you know they are important?"
  },
  {
    label: "Perfectionism",
    text: "Do you tend to focus excessively on minor details of a task, striving for perfection?"
  },
  {
    label: "Unmotivated",
    text: "Do you often feel unmotivated about starting your study, tasks or exam preparation, even if you know they are important?"
  },
  {
    label: "Fearful",
    text: "Do you often feel anxious about making decisions or participating in situations that require public speaking, group discussion or social interaction?"
  },
  {
    label: "Overwhelmed",
    text: "Do you often feel overwhelmed by your responsibilities, tasks, or academic workload, leading to a sense of being unable to cope, and do you often dwell on these feelings of inadequacy?"
  },
  {
    label: "Distracted",
    text: "Do you often find it difficult to focus on tasks or your study, easily distracted by your thoughts, social media or your surroundings?"
  },
  {
    label: "Disorganized",
    text: "Do you often find it difficult to stay organized?"
  },
  {
    label: "Passive",
    text: "Do you tend to agree to things without considering your feelings, often feeling unheard or taken advantage of, and do you find it difficult to express your wants and needs directly?"
  },
  {
    label: "Overachiever",
    text: "Do you often set high standards for yourself, constantly striving for top scores or excellent results and feeling the pressure to meet high standards often leading to thorough preparation, sometimes find it difficult to relax?"
  },
  {
    label: "Passive-Aggressive",
    text: "Do you tend to avoid confrontation, expressing dissatisfaction indirectly or subtly, and do you often feel resentment or anger without directly communicating it, perhaps through sarcasm or procrastination?"
  }
];

export const AssessmentModal: React.FC<AssessmentModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshProfile, userProfile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1); // 1 = Habits, 2 = Personality
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Ref for scrolling to top
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Store answers by question index/id
  const [habitAnswers, setHabitAnswers] = useState<Record<number, string>>({});
  const [personalityAnswers, setPersonalityAnswers] = useState<Record<number, string>>({});

  // Reset scroll when step changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [step, isOpen]);

  if (!isOpen) return null;

  const handleOptionSelect = (
    type: 'habit' | 'personality', 
    index: number, 
    value: string
  ) => {
    if (type === 'habit') {
      setHabitAnswers(prev => ({ ...prev, [index]: value }));
    } else {
      setPersonalityAnswers(prev => ({ ...prev, [index]: value }));
    }
  };

  const isStepComplete = () => {
    if (step === 1) {
      return STUDY_QUESTIONS.every((_, i) => habitAnswers[i]);
    }
    return PERSONALITY_QUESTIONS.every((_, i) => personalityAnswers[i]);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // Build Response Array
      const responses: AssessmentResponse[] = [];

      // Add Study Habits
      STUDY_QUESTIONS.forEach((q, i) => {
        responses.push({
          id: `habit-${i}`,
          category: 'Study Habits',
          question: q,
          answer: habitAnswers[i] || 'No Answer'
        });
      });

      // Add Personality
      PERSONALITY_QUESTIONS.forEach((q, i) => {
        responses.push({
          id: `personality-${i}`,
          category: 'Personality',
          question: q.text,
          label: q.label,
          answer: personalityAnswers[i] || 'No Answer'
        });
      });

      // 1. Save Assessment
      await addDoc(collection(db, 'assessments'), {
        userId: user.uid,
        submittedAt: Date.now(),
        responses: responses
      });

      // 2. Update User Profile Flag
      await updateDoc(doc(db, 'users', user.uid), {
        assessmentCompleted: true
      });

      // 3. Notify Admin
      await addDoc(collection(db, 'notifications'), {
        type: 'info',
        message: `${userProfile?.displayName || 'Student'} completed their Educational Assessment.`,
        createdAt: Date.now(),
        read: false,
        studentId: user.uid
      });

      await refreshProfile();
      setShowSuccess(true);
    } catch (error) {
      console.error("Error submitting assessment:", error);
      alert("Failed to submit assessment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setStep(1);
    onClose();
  };

  // --- Success Popup State ---
  if (showSuccess) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300 relative text-center p-8">
           
           {/* Success Icon */}
           <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6 shadow-sm border border-green-200 dark:border-green-800">
              <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400 animate-bounce" />
           </div>
           
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Great Job!</h2>
           <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed text-sm">
             Thank you for completing your assessment! We have received your answers and will review them shortly.
           </p>
           
           <div className="bg-gradient-to-br from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 p-5 rounded-xl border border-brand-100 dark:border-brand-800 mb-6 shadow-sm">
              <div className="flex justify-center mb-3">
                <div className="bg-brand-100 dark:bg-brand-900/50 p-2.5 rounded-full">
                   <Send className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-brand-800 dark:text-brand-200">
                We will reach out to you on telegram with your personalized result reviewed by our Dream Stars VIP Doctors! 🚀
              </p>
           </div>

           <Button onClick={handleCloseSuccess} className="w-full shadow-lg shadow-brand-500/20 py-3">
             Got it, thanks!
           </Button>
        </div>
      </div>
    );
  }

  // --- Main Assessment Modal ---
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header - Dynamic based on Step */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {step === 1 ? (
                <>
                   <BookOpen className="w-6 h-6 text-brand-500" />
                   Study Habits Assessment
                </>
              ) : (
                <>
                   <Target className="w-6 h-6 text-purple-500" />
                   Personality Test
                </>
              )}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-brand-500' : 'bg-green-500'}`}></span>
               {step === 1 ? 'Step 1 of 2: Routine & Planning' : 'Step 2 of 2: Character & Mindset'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700">
          <div 
            className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: step === 1 ? '50%' : '100%' }}
          ></div>
        </div>

        {/* Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 custom-scrollbar"
        >
          
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
               {/* Descriptive Banner for Step 1 */}
               <div className="flex items-center gap-4 mb-6 bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-sm">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Your study habit</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                       Evaluate your study habits to maximize productivity
                    </p>
                  </div>
               </div>

               {STUDY_QUESTIONS.map((q, index) => (
                 <div key={index} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-900/50 transition-colors">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-xs font-bold">
                           {index + 1}
                         </span>
                         <h4 className="font-bold text-slate-900 dark:text-white text-base">
                           Question {index + 1}
                         </h4>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed pl-8 font-medium">
                        {q}
                      </p>
                    </div>
                    
                    {/* Options Row */}
                    <div className="flex flex-wrap gap-2 pl-8 mt-4">
                       {CHOICES.map((choice) => {
                         const isSelected = habitAnswers[index] === choice;
                         return (
                           <button
                             key={choice}
                             onClick={() => handleOptionSelect('habit', index, choice)}
                             className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border ${
                               isSelected 
                               ? 'bg-brand-600 text-white border-brand-600 shadow-md ring-2 ring-brand-200 dark:ring-brand-900' 
                               : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-brand-600 hover:border-brand-200'
                             }`}
                           >
                             {choice}
                           </button>
                         );
                       })}
                    </div>
                 </div>
               ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
              {/* Descriptive Banner for Step 2 */}
              <div className="flex items-center gap-4 mb-6 bg-purple-50 dark:bg-purple-900/20 p-5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-sm">
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Your personality</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                       Identify your traits that influence your learning potential
                    </p>
                  </div>
               </div>

               {PERSONALITY_QUESTIONS.map((q, index) => (
                 <div key={index} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-900/50 transition-colors">
                    <div className="mb-3">
                      {/* Label Row */}
                      <div className="flex items-center gap-2 mb-2">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-xs font-bold">
                           {index + 1}
                         </span>
                         <h4 className="font-bold text-slate-900 dark:text-white text-base">
                           {q.label}
                         </h4>
                      </div>
                      
                      {/* Question Text */}
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed pl-8 font-medium">
                        {q.text}
                      </p>
                    </div>

                    {/* Options Row */}
                    <div className="flex flex-wrap gap-2 pl-8 mt-4">
                       {CHOICES.map((choice) => {
                         const isSelected = personalityAnswers[index] === choice;
                         return (
                           <button
                             key={choice}
                             onClick={() => handleOptionSelect('personality', index, choice)}
                             className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border ${
                               isSelected 
                               ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-200 dark:ring-purple-900' 
                               : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-white hover:text-purple-600 hover:border-purple-200 dark:hover:bg-slate-700'
                             }`}
                           >
                             {choice}
                           </button>
                         );
                       })}
                    </div>
                 </div>
               ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between gap-3 sticky bottom-0 z-10">
          {step === 2 ? (
            <Button variant="secondary" onClick={() => setStep(1)} className="gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : (
            <div></div> // Spacer
          )}
          
          {step === 1 ? (
             <Button 
                onClick={() => setStep(2)} 
                disabled={!isStepComplete()}
                className="gap-2 px-6 shadow-md"
             >
                Next Step <ChevronRight className="w-4 h-4" />
             </Button>
          ) : (
             <Button 
                onClick={handleSubmit} 
                isLoading={isSubmitting} 
                disabled={!isStepComplete()}
                className="gap-2 px-6 shadow-lg shadow-brand-500/20"
             >
               <CheckCircle2 className="w-4 h-4" /> Submit Assessment
             </Button>
          )}
        </div>

      </div>
    </div>
  );
};