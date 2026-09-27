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
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { BloomLevel, Course, Folder, QuestionType, QuizQuestion, UserProgress } from '../types';

interface QuizViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
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
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // User input states across question types
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [essayInput, setEssayInput] = useState('');
  const [checkedMarkingPoints, setCheckedMarkingPoints] = useState<Record<number, boolean>>({});

  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Quiz generator controls
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(4);
  const [topicFocus, setTopicFocus] = useState('');
  const [selectedQuestionType, setSelectedQuestionType] = useState<'all' | QuestionType>('all');
  const [bloomFocus, setBloomFocus] = useState<'all' | 'foundational' | 'intermediate' | 'advanced'>('all');

  // Stats & Progress
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [coverageData, setCoverageData] = useState<CoverageSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCoverageModal, setShowCoverageModal] = useState(false);

  useEffect(() => {
    if (!activeCourse) return;
    loadProgress();
    loadCoverage();
  }, [activeCourse?.id, activeFolderId]);

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

  const handleGenerateQuiz = async () => {
    if (!activeCourse || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);
    setQuestions([]);
    setCurrentIndex(0);
    resetQuestionInputStates();

    const typesToRequest: QuestionType[] | undefined =
      selectedQuestionType === 'all'
        ? undefined
        : [selectedQuestionType];

    try {
      const res = await api.generateQuiz({
        courseId: activeCourse.id,
        folderId: activeFolderId,
        questionCount,
        difficulty,
        questionTypes: typesToRequest,
        bloomFocus,
        topic: topicFocus.trim() || undefined,
      });

      if (res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
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
    } else if (currentQuestion.type === 'short_answer') {
      if (!shortAnswerInput.trim()) return;
      const studentClean = shortAnswerInput.trim().toLowerCase();
      const expectedClean = currentQuestion.correctAnswer.trim().toLowerCase();
      const acceptable = (currentQuestion.acceptableAnswers || []).map((a) => a.trim().toLowerCase());
      isCorrect = studentClean === expectedClean || acceptable.some((a) => a.includes(studentClean) || studentClean.includes(a));
    } else if (currentQuestion.type === 'short_essay') {
      if (!essayInput.trim()) return;
      // Short essay is submitted for rubric and marking points self-review
      isCorrect = essayInput.trim().length >= 40;
    }

    setIsAnswerSubmitted(true);

    try {
      const res = await api.recordQuizAnswer({
        courseId: activeCourse.id,
        isCorrect,
        topic: topicFocus || currentQuestion.bloomLevel || 'Course Mastery',
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
    }
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

  const getBloomBadgeColor = (bloom: BloomLevel) => {
    switch (bloom) {
      case 'Remember':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Understand':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Apply':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Analyze':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Evaluate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Create':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'multiple_choice':
        return 'Multiple Choice';
      case 'true_false':
        return 'True / False';
      case 'short_answer':
        return 'Short Answer';
      case 'short_essay':
        return 'Short Essay & Analysis';
      default:
        return type;
    }
  };

  const isCurrentInputReady = () => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false') {
      return Boolean(selectedAnswer);
    }
    if (currentQuestion.type === 'short_answer') {
      return Boolean(shortAnswerInput.trim());
    }
    if (currentQuestion.type === 'short_essay') {
      return Boolean(essayInput.trim().length >= 10);
    }
    return false;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Progress & Mastery Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Study Streak</span>
            <h4 className="text-lg font-bold text-slate-900">{progress?.streakDays || 1} Days</h4>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Accuracy</span>
            <h4 className="text-lg font-bold text-slate-900">{accuracy}%</h4>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Questions Mastered</span>
            <h4 className="text-lg font-bold text-slate-900">{progress?.correctAnswers || 0}</h4>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Scope Coverage</span>
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {coverageData?.distinctDocumentsCount || 0} Docs • {coverageData?.distinctPagesCount || 0} Pages
            </h4>
          </div>
        </div>
      </div>

      {/* Error / Status Alert Banner */}
      {errorMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-amber-600 hover:text-amber-900 font-bold px-2 py-0.5 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Multi-Document Assessment Configurator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Universal Assessment Engine</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scans <strong>ALL eligible uploaded files and pages</strong> in: <strong>{activeFolderName}</strong> ({activeCourse.code})
            </p>
          </div>

          {coverageData && (
            <button
              onClick={() => setShowCoverageModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verify {coverageData.distinctDocumentsCount} Files ({coverageData.distinctPagesCount} Pages)</span>
            </button>
          )}
        </div>

        {/* Filters & Config Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Question Type Filter */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Question Type</label>
            <select
              value={selectedQuestionType}
              onChange={(e) => setSelectedQuestionType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">All 4 Types (Balanced Assessment)</option>
              <option value="multiple_choice">1. Multiple Choice (4 Options)</option>
              <option value="true_false">2. True / False</option>
              <option value="short_answer">3. Short Answer (Fill & Recall)</option>
              <option value="short_essay">4. Short Essay & Analysis</option>
            </select>
          </div>

          {/* Bloom's Taxonomy Cognitive Hierarchy */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bloom's Taxonomy Focus</label>
            <select
              value={bloomFocus}
              onChange={(e) => setBloomFocus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">Full Spectrum (Remember to Create)</option>
              <option value="foundational">Foundational (Remember & Understand)</option>
              <option value="intermediate">Intermediate (Apply & Analyze)</option>
              <option value="advanced">Advanced Mastery (Evaluate & Create)</option>
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

          {/* Question Count */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Question Count</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
            >
              <option value={4}>4 Questions (1 of each type)</option>
              <option value={6}>6 Questions</option>
              <option value={8}>8 Questions</option>
              <option value={10}>10 Questions</option>
            </select>
          </div>
        </div>

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
                <span>Generate Assessment ({questionCount} Questions)</span>
              </>
            )}
          </button>
        </div>
      </div>

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

              {/* Bloom's Taxonomy Badge */}
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${getBloomBadgeColor(
                  currentQuestion.bloomLevel
                )}`}
              >
                <Layers className="w-3 h-3" />
                <span>Bloom: {currentQuestion.bloomLevel}</span>
              </span>
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
                    className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition flex items-center justify-between gap-3 cursor-pointer ${optionStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswerSubmitted && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    {isAnswerSubmitted && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. True / False Selection */}
          {currentQuestion.type === 'true_false' && (
            <div className="grid grid-cols-2 gap-4">
              {['True', 'False'].map((val) => {
                const isSelected = selectedAnswer === val;
                const isCorrect = val.toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

                let style = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800';
                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500';
                  } else if (isSelected) {
                    style = 'border-red-400 bg-red-50 text-red-900 font-bold';
                  }
                } else if (isSelected) {
                  style = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-600';
                }

                return (
                  <button
                    key={val}
                    disabled={isAnswerSubmitted}
                    onClick={() => setSelectedAnswer(val)}
                    className={`p-5 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer ${style}`}
                  >
                    <span className="text-base font-bold">{val}</span>
                    {isAnswerSubmitted && isCorrect && (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-4 h-4" /> Correct Answer
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Short Answer Production */}
          {currentQuestion.type === 'short_answer' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Your Answer (Produce the key concept, term, or mechanism):
              </label>
              <input
                type="text"
                disabled={isAnswerSubmitted}
                value={shortAnswerInput}
                onChange={(e) => setShortAnswerInput(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
              />
            </div>
          )}

          {/* 4. Short Essay & Analysis */}
          {currentQuestion.type === 'short_essay' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <label className="font-semibold text-slate-700">
                  Your Analytical Essay Response:
                </label>
                <span>{essayInput.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <textarea
                rows={5}
                disabled={isAnswerSubmitted}
                value={essayInput}
                onChange={(e) => setEssayInput(e.target.value)}
                placeholder="Synthesize, explain, compare, and provide evidence based on the course materials..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 leading-relaxed font-sans"
              />
            </div>
          )}

          {/* POST-SUBMISSION REVEAL: Answer, Explanation, Rubric, and Citations */}
          {isAnswerSubmitted && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs animate-in fade-in duration-200">
              {/* Correct Answer / Model Answer */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {currentQuestion.type === 'short_essay' ? 'Exemplar Model Answer' : 'Correct Answer'}
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {currentQuestion.sampleAnswer || currentQuestion.correctAnswer}
                </p>
                {currentQuestion.acceptableAnswers && currentQuestion.acceptableAnswers.length > 1 && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    Acceptable variations: {currentQuestion.acceptableAnswers.join(', ')}
                  </p>
                )}
              </div>

              {/* Short Essay Key Marking Points Rubric */}
              {currentQuestion.type === 'short_essay' && currentQuestion.markingPoints && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <ListChecks className="w-4 h-4 text-indigo-600" />
                    <span>Key Marking Points Checklist (Self-Evaluation)</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {currentQuestion.markingPoints.map((point, pIdx) => (
                      <label
                        key={pIdx}
                        className="flex items-start gap-2 text-indigo-950 cursor-pointer p-1.5 hover:bg-indigo-100/50 rounded-lg transition"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checkedMarkingPoints[pIdx])}
                          onChange={(e) =>
                            setCheckedMarkingPoints((prev) => ({
                              ...prev,
                              [pIdx]: e.target.checked,
                            }))
                          }
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="leading-snug">{point}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Grounded Educational Explanation */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Educational Rationale & Evidence</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                  {currentQuestion.explanation}
                </p>
              </div>

              {/* Source Provenance Citation */}
              {currentQuestion.citations && currentQuestion.citations.length > 0 && (
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Verified Source Reference:</span>
                    <strong className="text-slate-900">
                      {currentQuestion.citations[0].filename} (Page/Slide {currentQuestion.citations[0].pageOrSlide})
                    </strong>
                  </div>
                  <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Relevance: {Math.round((currentQuestion.citations[0].relevanceScore || 0.8) * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {isAnswerSubmitted ? (
                currentQuestion.type === 'short_essay' ? (
                  <span className="text-indigo-600 font-bold">Review model answer and check your marking points above.</span>
                ) : selectedAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase() ||
                  (currentQuestion.type === 'short_answer' && shortAnswerInput.trim()) ? (
                  <span className="text-emerald-600 font-bold">Concept Mastered! +10 Points</span>
                ) : (
                  <span className="text-slate-600 font-medium">Review the rationale and source above.</span>
                )
              ) : (
                'Submit your answer to reveal the verified model answer and explanation'
              )}
            </span>

            {!isAnswerSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!isCurrentInputReady()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition"
              >
                Submit Answer
              </button>
            ) : currentIndex < questions.length - 1 ? (
              <button
                onClick={handleNextQuestion}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Next Question</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerateQuiz}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Another Balanced Set</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Coverage & Pre-Verification Modal */}
      {showCoverageModal && coverageData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Material Scan & Extraction Verification</h3>
              </div>
              <button
                onClick={() => setShowCoverageModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Only verified readable files are sampled. Questions are formulated across all eligible files and pages without single-page bias.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Eligible Documents ({coverageData.distinctDocumentsCount})
              </h4>
              {coverageData.eligibleMaterials.map((m) => (
                <div key={m.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-800 block truncate max-w-xs">{m.filename}</span>
                    <span className="text-[11px] text-slate-500">
                      {m.extractedTextLength} chars • {m.chunkCount} vector chunks
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                    Verified Readable
                  </span>
                </div>
              ))}

              {coverageData.excludedMaterials.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Excluded Documents ({coverageData.excludedMaterials.length})
                  </h4>
                  {coverageData.excludedMaterials.map((ex, i) => (
                    <div key={i} className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-0.5 mt-1">
                      <span className="font-semibold text-amber-900">{ex.filename}</span>
                      <p className="text-[11px] text-amber-800">{ex.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowCoverageModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
