import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  Flame,
  HelpCircle,
  Layers,
  ListChecks,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder, PastPaper, QuestionType, QuizQuestion, UserProgress } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface QuizViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  initialPastPaperId?: string | null;
}

interface CoverageSummary {
  eligibleMaterials: { id: string; filename: string; extractedTextLength: number; chunkCount: number }[];
  excludedMaterials: { filename: string; reason: string }[];
  totalReadableChunks: number;
  distinctPagesCount: number;
  distinctDocumentsCount: number;
}

export const QuizView: React.FC<QuizViewProps> = ({
  activeCourse,
  folders,
  activeFolderId,
  initialPastPaperId,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // User input states across question types
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [fillInBlankInput, setFillInBlankInput] = useState('');
  const [essayInput, setEssayInput] = useState('');
  const [checkedMarkingPoints, setCheckedMarkingPoints] = useState<Record<number, boolean>>({});

  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Quiz generator controls
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [topicFocus, setTopicFocus] = useState('');
  const [selectedQuestionType, setSelectedQuestionType] = useState<'all' | QuestionType>('all');
  const [questionStyle, setQuestionStyle] = useState<'all' | 'definitions' | 'explanations' | 'comparisons' | 'applied'>('all');
  const [isMockExam, setIsMockExam] = useState(false);
  const [mockExamDuration, setMockExamDuration] = useState(30); // in minutes
  const [mockTimeRemaining, setMockTimeRemaining] = useState<number | null>(null);

  // Past Papers Available for Calibration
  const [availablePastPapers, setAvailablePastPapers] = useState<PastPaper[]>([]);
  const [selectedPastPaperIds, setSelectedPastPaperIds] = useState<string[]>([]);

  // Stats & Progress
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [coverageData, setCoverageData] = useState<CoverageSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [showExamFinishedModal, setShowExamFinishedModal] = useState(false);

  // User exam score calculation
  const [examResults, setExamResults] = useState<{
    correctCount: number;
    totalCount: number;
    marksObtained: number;
    totalMarks: number;
  }>({ correctCount: 0, totalCount: 0, marksObtained: 0, totalMarks: 0 });

  useEffect(() => {
    if (!activeCourse) return;
    loadProgress();
    loadCoverage();
    loadPastPapers();
  }, [activeCourse?.id, activeFolderId]);

  useEffect(() => {
    if (initialPastPaperId) {
      setSelectedPastPaperIds([initialPastPaperId]);
      setIsMockExam(true);
    }
  }, [initialPastPaperId]);

  // Mock Exam Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isMockExam && mockTimeRemaining !== null && mockTimeRemaining > 0 && !showExamFinishedModal) {
      interval = setInterval(() => {
        setMockTimeRemaining((prev) => {
          if (prev !== null && prev <= 1) {
            setShowExamFinishedModal(true);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMockExam, mockTimeRemaining, showExamFinishedModal]);

  const loadProgress = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getProgress(activeCourse.id);
      setProgress(res.progress);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  };

  const loadCoverage = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getCoverage(activeCourse.id, activeFolderId);
      setCoverageData(res);
    } catch (err) {
      console.error('Failed to load coverage:', err);
    }
  };

  const loadPastPapers = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getPastPapers(activeCourse.id, activeFolderId);
      setAvailablePastPapers(res.pastPapers || []);
    } catch (err) {
      console.error('Failed to load past papers:', err);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!activeCourse || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);
    setQuestions([]);
    setCurrentIndex(0);
    resetQuestionInputStates();
    setShowExamFinishedModal(false);

    const typesToRequest: QuestionType[] | undefined =
      selectedQuestionType === 'all' ? undefined : [selectedQuestionType];

    try {
      const res = await api.generateQuiz({
        courseId: activeCourse.id,
        folderId: activeFolderId,
        questionCount,
        difficulty,
        questionTypes: typesToRequest,
        questionStyle: questionStyle === 'all' ? undefined : questionStyle,
        pastPaperIds: selectedPastPaperIds.length > 0 ? selectedPastPaperIds : undefined,
        topic: topicFocus.trim() || undefined,
        isMockExam,
      });

      if (res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
        if (isMockExam) {
          setMockTimeRemaining(mockExamDuration * 60);
          const totalMarks = res.questions.reduce((sum, q) => sum + (q.allocatedMarks || 2), 0);
          setExamResults({ correctCount: 0, totalCount: res.questions.length, marksObtained: 0, totalMarks });
        }
      } else {
        setErrorMessage('No questions could be generated. Ensure files in this folder contain readable text.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Assessment generation note: ${msg}`);
    } finally {
      setIsGenerating(false);
      loadCoverage();
    }
  };

  const resetQuestionInputStates = () => {
    setSelectedAnswer(null);
    setShortAnswerInput('');
    setFillInBlankInput('');
    setEssayInput('');
    setCheckedMarkingPoints({});
    setIsAnswerSubmitted(false);
  };

  const currentQuestion: QuizQuestion | undefined = questions[currentIndex];

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || isAnswerSubmitted || !activeCourse) return;

    let isCorrect = false;

    if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false') {
      if (!selectedAnswer) return;
      isCorrect = selectedAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    } else if (currentQuestion.type === 'fill_in_blank') {
      if (!fillInBlankInput.trim()) return;
      const studentClean = fillInBlankInput.trim().toLowerCase();
      const expectedClean = currentQuestion.correctAnswer.trim().toLowerCase();
      const acceptable = (currentQuestion.acceptableAnswers || []).map((a) => a.trim().toLowerCase());
      isCorrect = studentClean === expectedClean || acceptable.some((a) => a === studentClean || a.includes(studentClean));
    } else if (currentQuestion.type === 'short_answer') {
      if (!shortAnswerInput.trim()) return;
      const studentClean = shortAnswerInput.trim().toLowerCase();
      const expectedClean = currentQuestion.correctAnswer.trim().toLowerCase();
      const acceptable = (currentQuestion.acceptableAnswers || []).map((a) => a.trim().toLowerCase());
      isCorrect = studentClean === expectedClean || acceptable.some((a) => a.includes(studentClean) || studentClean.includes(a));
    } else if (currentQuestion.type === 'short_essay') {
      if (!essayInput.trim()) return;
      isCorrect = essayInput.trim().length >= 40;
    }

    setIsAnswerSubmitted(true);

    if (isMockExam) {
      const marksEarned = isCorrect ? currentQuestion.allocatedMarks || 2 : 0;
      setExamResults((prev) => ({
        ...prev,
        correctCount: prev.correctCount + (isCorrect ? 1 : 0),
        marksObtained: prev.marksObtained + marksEarned,
      }));
    }

    try {
      const res = await api.recordQuizAnswer({
        courseId: activeCourse.id,
        isCorrect,
        topic: topicFocus || currentQuestion.topic || 'Past-Paper Examination',
      });
      setProgress(res.progress);
    } catch (err) {
      console.error('Failed to record answer:', err);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetQuestionInputStates();
    } else if (isMockExam) {
      setShowExamFinishedModal(true);
    }
  };

  const togglePastPaperSelection = (id: string) => {
    setSelectedPastPaperIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Course Folders'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  if (!activeCourse) return null;

  const accuracy =
    progress && progress.totalQuestionsAnswered > 0
      ? Math.round((progress.correctAnswers / progress.totalQuestionsAnswered) * 100)
      : 0;

  const getQuestionTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'multiple_choice':
        return 'Multiple Choice';
      case 'true_false':
        return 'True / False';
      case 'fill_in_blank':
        return 'Fill-in-the-Blank';
      case 'short_answer':
        return 'Short Answer';
      case 'short_essay':
        return 'Short Essay & Analysis';
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* View Header & Metric Highlights */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Active Recall & Examinations</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              {activeCourse.code}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Document-first examination engine. Inspects your uploaded materials and generates questions strictly aligned with past-paper examination style in{' '}
            <strong className="text-slate-800 font-semibold">{activeFolderName}</strong>.
          </p>
        </div>

        {/* Learning Mastery Badges */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <div>
              <span className="text-[11px] font-semibold text-amber-800 uppercase block leading-none">Streak</span>
              <span className="text-sm font-bold text-amber-900">{progress?.streakDays || 1} day(s)</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-500" />
            <div>
              <span className="text-[11px] font-semibold text-emerald-800 uppercase block leading-none">Accuracy</span>
              <span className="text-sm font-bold text-emerald-900">{accuracy}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scope Verification Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Scope includes{' '}
            <strong className="text-slate-900 font-semibold">{coverageData?.distinctDocumentsCount || 0} files</strong> (
            {coverageData?.distinctPagesCount || 0} distinct pages/sections) in <span className="font-semibold text-indigo-600">{activeFolderName}</span>.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <VectorSyncIndicator
            activeCourse={activeCourse}
            activeFolderId={activeFolderId}
            folders={folders}
          />
          <button
            onClick={() => setShowCoverageModal(true)}
            className="text-indigo-600 font-semibold hover:underline cursor-pointer ml-1 shrink-0"
          >
            View Verified Files
          </button>
        </div>
      </div>

      {/* Exam / Quiz Generator Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Assessment Configuration</h3>
          </div>

          {/* Mock Exam Mode Toggle */}
          <button
            onClick={() => setIsMockExam(!isMockExam)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              isMockExam
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            {isMockExam ? 'Mock Exam Mode (Timed)' : 'Practice Mode'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Question Type Filter */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Question Type</label>
            <select
              value={selectedQuestionType}
              onChange={(e: any) => setSelectedQuestionType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">All 5 Types (Balanced Exam Mix)</option>
              <option value="multiple_choice">Multiple Choice (MCQ)</option>
              <option value="true_false">True / False</option>
              <option value="fill_in_blank">Fill-in-the-Blank</option>
              <option value="short_answer">Short Answer</option>
              <option value="short_essay">Short Essay & Analysis</option>
            </select>
          </div>

          {/* Past-Paper Style Focus */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Past-Paper Style Focus</label>
            <select
              value={questionStyle}
              onChange={(e: any) => setQuestionStyle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">Comprehensive Examination Mix</option>
              <option value="definitions">Definitions & Facts (What is, Define, State, List)</option>
              <option value="explanations">Mechanisms & Explanations (Explain, Why, Describe)</option>
              <option value="comparisons">Comparative & Analytical (Differentiate, Compare, Outline)</option>
              <option value="applied">Applied & Functions (What are the functions, Give examples)</option>
            </select>
          </div>

          {/* Target Difficulty */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e: any) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
            >
              <option value="easy">Easy (Core Principles & Definitions)</option>
              <option value="medium">Medium (Analytical Application)</option>
              <option value="hard">Hard (Synthesis & Problem Solving)</option>
            </select>
          </div>

          {/* Question Count / Duration */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {isMockExam ? 'Exam Length & Timer' : 'Question Count'}
            </label>
            {isMockExam ? (
              <select
                value={mockExamDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setMockExamDuration(val);
                  setQuestionCount(val >= 45 ? 10 : val >= 30 ? 6 : 4);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
              >
                <option value={15}>15 Mins (4 Questions)</option>
                <option value={30}>30 Mins (6 Questions)</option>
                <option value={45}>45 Mins (8 Questions)</option>
                <option value={60}>60 Mins (10 Questions)</option>
              </select>
            ) : (
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
              >
                <option value={4}>4 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
              </select>
            )}
          </div>
        </div>

        {/* Past Paper Style Calibration Selector */}
        {availablePastPapers.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">
              Calibrate Style & Marks with Past Papers (Optional):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {availablePastPapers.map((pp) => {
                const isSelected = selectedPastPaperIds.includes(pp.id);
                return (
                  <button
                    key={pp.id}
                    onClick={() => togglePastPaperSelection(pp.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 text-slate-400" />
                    <span>{pp.title}</span>
                    {pp.year && <span className="text-[10px] text-slate-400">({pp.year})</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              *Selected past papers provide examination style, wording, and marks. All factual content strictly stems from course materials.
            </p>
          </div>
        )}

        {/* Optional Topic Filter & Action */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <input
            type="text"
            placeholder="Optional specific concept or topic focus (e.g. Puberty HPG axis, Gradient Descent, Structuralism)..."
            value={topicFocus}
            onChange={(e) => setTopicFocus(e.target.value)}
            className="w-full sm:flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />

          <button
            onClick={handleGenerateQuiz}
            disabled={isGenerating}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition shrink-0"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Scanning All Files & Generating...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>{isMockExam ? 'Start Mock Examination' : `Generate Assessment (${questionCount} Questions)`}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Mock Exam Timer Banner */}
      {isMockExam && mockTimeRemaining !== null && questions.length > 0 && (
        <div className="bg-purple-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-purple-300" />
            <div>
              <span className="text-xs uppercase tracking-wider text-purple-200 block font-semibold">
                Official Mock Examination Active
              </span>
              <span className="text-xs text-purple-100">
                Question {currentIndex + 1} of {questions.length} • Total Marks: {examResults.totalMarks}
              </span>
            </div>
          </div>
          <div className="bg-purple-800 px-4 py-2 rounded-xl text-lg font-mono font-bold text-purple-100">
            {formatSeconds(mockTimeRemaining)}
          </div>
        </div>
      )}

      {/* Quiz Interaction Card */}
      {questions.length > 0 && currentQuestion ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 animate-in fade-in duration-150">
          {/* Question Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                Question {currentIndex + 1} of {questions.length}
              </span>

              {/* Question Type Badge */}
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                {getQuestionTypeLabel(currentQuestion.type)}
              </span>

              {/* Question Style / Topic Badge */}
              {currentQuestion.questionStyle ? (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>{currentQuestion.questionStyle}</span>
                </span>
              ) : currentQuestion.topic ? (
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>{currentQuestion.topic}</span>
                </span>
              ) : null}

              {currentQuestion.allocatedMarks && (
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {currentQuestion.allocatedMarks} mark{currentQuestion.allocatedMarks > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <span className="text-xs font-semibold text-slate-500 capitalize">
              Difficulty: {currentQuestion.difficulty}
            </span>
          </div>

          {/* Question Academic Prompt */}
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {currentQuestion.question}
          </h3>

          {/* 1. Multiple Choice Options */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="space-y-2.5">
              {currentQuestion.options.map((opt, i) => {
                const isSelected = selectedAnswer === opt;
                const isCorrect = opt.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

                let optionStyle = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800';
                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                  } else if (isSelected) {
                    optionStyle = 'border-red-400 bg-red-50 text-red-900 font-semibold';
                  }
                } else if (isSelected) {
                  optionStyle = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold ring-1 ring-indigo-600';
                }

                return (
                  <button
                    key={i}
                    disabled={isAnswerSubmitted}
                    onClick={() => setSelectedAnswer(opt)}
                    className={`w-full text-left p-4 rounded-xl border text-sm transition flex items-center justify-between cursor-pointer ${optionStyle}`}
                  >
                    <span className="flex-1">{opt}</span>
                    {isAnswerSubmitted && isCorrect && <Check className="w-5 h-5 text-emerald-600 shrink-0 ml-2" />}
                    {isAnswerSubmitted && isSelected && !isCorrect && (
                      <X className="w-5 h-5 text-red-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. True / False Options */}
          {currentQuestion.type === 'true_false' && (
            <div className="grid grid-cols-2 gap-4">
              {['True', 'False'].map((choice) => {
                const isSelected = selectedAnswer === choice;
                const isCorrect = choice.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();

                let style = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800';
                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500';
                  } else if (isSelected) {
                    style = 'border-red-400 bg-red-50 text-red-900 font-bold';
                  }
                } else if (isSelected) {
                  style = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600';
                }

                return (
                  <button
                    key={choice}
                    disabled={isAnswerSubmitted}
                    onClick={() => setSelectedAnswer(choice)}
                    className={`p-4 rounded-xl border text-center font-bold text-sm transition cursor-pointer ${style}`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Fill-in-the-Blank Direct Production */}
          {currentQuestion.type === 'fill_in_blank' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Type the exact missing term or keyword:
              </label>
              <input
                type="text"
                disabled={isAnswerSubmitted}
                placeholder="Enter missing term..."
                value={fillInBlankInput}
                onChange={(e) => setFillInBlankInput(e.target.value)}
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          )}

          {/* 4. Short Answer Input */}
          {currentQuestion.type === 'short_answer' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Provide your precise answer or definition:
              </label>
              <input
                type="text"
                disabled={isAnswerSubmitted}
                placeholder="Type your response here..."
                value={shortAnswerInput}
                onChange={(e) => setShortAnswerInput(e.target.value)}
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          )}

          {/* 5. Short Essay & Analysis Writing Area */}
          {currentQuestion.type === 'short_essay' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Compose your analytical response (synthesize arguments, mechanisms, and examples):
              </label>
              <textarea
                rows={5}
                disabled={isAnswerSubmitted}
                placeholder="Write your comprehensive analysis here..."
                value={essayInput}
                onChange={(e) => setEssayInput(e.target.value)}
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          )}

          {/* Submit / Reveal Answer Controls */}
          {!isAnswerSubmitted ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={
                (currentQuestion.type === 'multiple_choice' && !selectedAnswer) ||
                (currentQuestion.type === 'true_false' && !selectedAnswer) ||
                (currentQuestion.type === 'fill_in_blank' && !fillInBlankInput.trim()) ||
                (currentQuestion.type === 'short_answer' && !shortAnswerInput.trim()) ||
                (currentQuestion.type === 'short_essay' && !essayInput.trim())
              }
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Answer for Verification</span>
            </button>
          ) : (
            <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in duration-200">
              {/* Evidence Insufficiency Warning if Applicable */}
              {currentQuestion.explanation?.toLowerCase().includes('not sufficiently supported') && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Verification Notice:</strong> The evidence in the uploaded course documents does not sufficiently support a definitive conclusion on this point.
                  </span>
                </div>
              )}

              {/* Essay Self-Scoring Marking Points Checklist */}
              {currentQuestion.type === 'short_essay' && currentQuestion.markingPoints && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-indigo-700" />
                    <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wider">
                      Examiner Marking Points Checklist
                    </h4>
                  </div>
                  <p className="text-xs text-indigo-900">
                    Review your response and check off each essential criterion you successfully addressed:
                  </p>
                  <div className="space-y-2">
                    {currentQuestion.markingPoints.map((point, pIdx) => (
                      <label
                        key={pIdx}
                        className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedMarkingPoints[pIdx]}
                          onChange={(e) =>
                            setCheckedMarkingPoints((prev) => ({
                              ...prev,
                              [pIdx]: e.target.checked,
                            }))
                          }
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{point}</span>
                      </label>
                    ))}
                  </div>

                  {currentQuestion.sampleAnswer && (
                    <div className="mt-3 pt-3 border-t border-indigo-200/50">
                      <span className="text-[11px] font-bold text-indigo-900 uppercase block mb-1">
                        Exemplar Model Answer:
                      </span>
                      <p className="text-xs text-indigo-950/90 italic leading-relaxed">
                        "{currentQuestion.sampleAnswer}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Standard Correct Answer Reveal for Non-Essay Types */}
              {currentQuestion.type !== 'short_essay' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Verified Correct Answer:
                  </span>
                  <p className="text-sm font-bold text-emerald-800">
                    {currentQuestion.correctAnswer}
                  </p>
                  {currentQuestion.acceptableAnswers && currentQuestion.acceptableAnswers.length > 1 && (
                    <p className="text-xs text-slate-500">
                      Accepted variations: {currentQuestion.acceptableAnswers.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Explanation */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Pedagogical Explanation:
                </span>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>

              {/* Citations Box */}
              {currentQuestion.citations && currentQuestion.citations.length > 0 && (
                <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                    Verified Citation & Source Provenance:
                  </span>
                  {currentQuestion.citations.map((cite, cIdx) => (
                    <div key={cIdx} className="text-xs text-slate-700 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{cite.filename}</span>
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                          Page/Slide {cite.pageOrSlide}
                        </span>
                      </div>
                      <p className="italic text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-100">
                        "{cite.sourceExcerpt}"
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Question Button */}
              <button
                onClick={handleNextQuestion}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{currentIndex < questions.length - 1 ? 'Next Question' : 'Complete Assessment'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Ready for Assessment</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Click <strong>Generate Assessment</strong> or <strong>Start Mock Examination</strong> to test your mastery.
          </p>
        </div>
      )}

      {/* Coverage Modal */}
      {showCoverageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Verified Documents in Scope</h3>
              <button onClick={() => setShowCoverageModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
              {coverageData?.eligibleMaterials.map((mat) => (
                <div key={mat.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{mat.filename}</h4>
                    <span className="text-slate-500">
                      {mat.chunkCount} indexed chunks • {Math.round(mat.extractedTextLength / 1000)}k characters
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    Verified
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowCoverageModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock Exam Finished In-App Modal */}
      {showExamFinishedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <Award className="w-12 h-12 text-indigo-600 mx-auto" />
            <h3 className="text-lg font-extrabold text-slate-900">Examination Completed!</h3>
            <p className="text-xs text-slate-600">
              You completed the mock exam for <strong>{activeCourse.title}</strong>.
            </p>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Questions Answered:</span>
                <span className="text-base font-bold text-slate-900">
                  {examResults.correctCount} / {examResults.totalCount}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Marks Obtained:</span>
                <span className="text-base font-bold text-indigo-600">
                  {examResults.marksObtained} / {examResults.totalMarks}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowExamFinishedModal(false);
                setQuestions([]);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
            >
              Close & Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
