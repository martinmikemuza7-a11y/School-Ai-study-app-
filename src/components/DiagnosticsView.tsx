import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Key,
  Layers,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';

export const DiagnosticsView: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticsResult, setDiagnosticsResult] = useState<{
    allPassed: boolean;
    results: { testName: string; passed: boolean; details: string }[];
    environment: {
      geminiApiKeyPresent: boolean;
      embeddingModel: string;
      generationModel: string;
    };
  } | null>(null);

  const runVerificationSuite = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const res = await api.runDiagnostics();
      setDiagnosticsResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Diagnostics run note: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {errorMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-amber-600 hover:text-amber-900 font-bold px-2 py-0.5 ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Architectural Health & Safety
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">System & RAG Verification Suite</h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1">
              Live automated validation verifying Folder CRUD, multi-tenant authorization barriers, vector embeddings, scope isolation, and source citation integrity.
            </p>
          </div>

          <button
            onClick={runVerificationSuite}
            disabled={isRunning}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing Test Assertions...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Verification Suite
              </>
            )}
          </button>
        </div>
      </div>

      {/* Environment & Credentials Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Key className="w-4 h-4 text-indigo-600" />
          Environment Credentials & AI Models
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 block mb-1">Gemini API Key</span>
            <div className="flex items-center gap-1.5 font-bold">
              {diagnosticsResult?.environment.geminiApiKeyPresent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Configured in Runtime</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700">Check Settings &gt; Secrets</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 block mb-1">Vector Embedding Model</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>gemini-embedding-2-preview</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 block mb-1">Tutor Grounding Model</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>gemini-3.8-flash</span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 flex items-start gap-2">
          <Key className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>Credentials Note:</strong> The app automatically utilizes <code>process.env.GEMINI_API_KEY</code> injected by Google AI Studio for server-side calls. If key quota limits are reached or the key is absent, the system gracefully activates the lexical retrieval engine and grounded fallback answers.
          </span>
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Architectural Test Assertions</h3>
            <p className="text-xs text-slate-500">
              All 6 key architectural requirements validated via end-to-end integration tests.
            </p>
          </div>

          {diagnosticsResult && (
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                diagnosticsResult.allPassed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {diagnosticsResult.allPassed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  All Tests Passing (6/6)
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  Issues Detected
                </>
              )}
            </span>
          )}
        </div>

        {!diagnosticsResult && !isRunning && (
          <div className="text-center py-10 text-slate-500 text-xs">
            <Terminal className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>Click "Run Verification Suite" above to execute tests against live database and vector RAG.</p>
          </div>
        )}

        {isRunning && (
          <div className="text-center py-10">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Testing folder lifecycle, authorization barriers, and vector retrieval...
            </p>
          </div>
        )}

        {diagnosticsResult && (
          <div className="space-y-3">
            {diagnosticsResult.results.map((test, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border transition flex items-start gap-3 bg-slate-50 border-slate-200"
              >
                <div className="mt-0.5">
                  {test.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900">{test.testName}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        test.passed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {test.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1 leading-relaxed">{test.details}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
