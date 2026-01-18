
import React, { useState } from 'react';
import { AuditRequest, AuditResult, AuditStep } from './types';
import { GeminiService } from './services/geminiService';
import AuditForm from './components/AuditForm';
import ProcessingStatus from './components/ProcessingStatus';
import ResultsView from './components/ResultsView';

const App: React.FC = () => {
  const [step, setStep] = useState<AuditStep>(AuditStep.IDLE);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartAudit = async (request: AuditRequest) => {
    setResult(null);
    setError(null);
    setStep(AuditStep.MAPPING);

    try {
      const gemini = new GeminiService();
      
      const stepDelays = [
        { s: AuditStep.FACT_CHECKING, d: 2000 },
        { s: AuditStep.GAP_ANALYSIS, d: 5000 },
        { s: AuditStep.GENERATING_FIX, d: 9000 }
      ];

      stepDelays.forEach(item => {
        setTimeout(() => setStep(item.s), item.d);
      });

      const auditResult = await gemini.performAudit(request);
      setResult(auditResult);
      setStep(AuditStep.COMPLETED);
      
      // Auto-scroll to results
      setTimeout(() => {
        const resultsEl = document.getElementById('audit-results-container');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'The intelligence protocol encountered a fatal error. Please verify the target domain is active.');
      setStep(AuditStep.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] bg-cyan-500/[0.03] blur-[180px] rounded-full"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-blue-600/[0.03] blur-[180px] rounded-full"></div>
      </div>

      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-5 group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-12 h-12 bg-cyan-400 rounded-2xl flex items-center justify-center text-slate-950 transform group-hover:rotate-12 transition-all shadow-[0_0_30px_rgba(34,211,238,0.4)]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h1 className="heading-font text-3xl font-black tracking-tighter text-white leading-none">PeptideGo</h1>
              <p className="text-[10px] uppercase tracking-[0.5em] text-cyan-400 font-black mt-2">Intelligence Core</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-8 py-3.5 bg-white text-slate-950 rounded-full text-[11px] font-black uppercase tracking-[0.1em] hover:bg-cyan-400 transition-all shadow-xl hover:shadow-cyan-400/20 active:scale-95"
            >
              Reset Terminal
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-48">
        {/* Intro */}
        <div className="max-w-4xl mx-auto mb-28 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 mb-10">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_#22d3ee]"></span>
            <span className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.4em] leading-none">Agent Protocol: Active</span>
          </div>
          <h2 className="heading-font text-7xl md:text-9xl font-black text-white mb-12 tracking-tighter leading-[0.9]">
            Control What AI Says About<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500">Your Peptide</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            PeptideGo audits the gap between brand reality and AI hallucination, generating citation-backed strategic copy for modern search engines. Focused on high-fidelity <span className="text-cyan-400 font-medium">topical peptides</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* Controls Side */}
          <div className="lg:col-span-4 space-y-12 lg:sticky lg:top-36">
            <AuditForm 
              onStart={handleStartAudit} 
              isLoading={step !== AuditStep.IDLE && step !== AuditStep.COMPLETED && step !== AuditStep.ERROR} 
            />
            <ProcessingStatus step={step} />
            
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-10 rounded-[3rem] text-rose-200 text-sm flex gap-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="shrink-0 text-rose-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="font-black mb-3 uppercase tracking-widest text-xs">Analysis Failed</div>
                  <p className="opacity-90 font-medium leading-relaxed text-base">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Results Side */}
          <div id="audit-results-container" className="lg:col-span-8 scroll-mt-36">
            {result ? (
              <ResultsView result={result} />
            ) : (
              <div className="space-y-16">
                {step === AuditStep.IDLE ? (
                  <div className="glass-panel rounded-[4rem] min-h-[700px] flex flex-col items-center justify-center text-slate-500 p-20 text-center border-dashed border-white/10 group transition-all hover:bg-white/[0.02]">
                    <div className="w-40 h-40 bg-slate-900/50 rounded-full flex items-center justify-center mb-12 border border-white/5 shadow-2xl transition-all group-hover:scale-110 group-hover:border-cyan-400/20">
                      <svg className="w-20 h-20 text-cyan-400/10 group-hover:text-cyan-400/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <h3 className="heading-font text-4xl font-black text-white/80 mb-6 tracking-tight">System Ready</h3>
                    <p className="max-w-md mx-auto text-lg leading-relaxed opacity-40 font-light">
                      Target a brand domain to identify product hallucinations and generate high-trust clinical GEO fixes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-16 animate-pulse">
                    <div className="h-[400px] bg-slate-900/50 rounded-[4rem] w-full border border-white/5"></div>
                    <div className="h-48 bg-slate-900/50 rounded-[4rem] w-full border border-white/5"></div>
                    <div className="h-[600px] bg-slate-900/50 rounded-[4rem] w-full border border-white/5"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-60 pt-24 pb-20 border-t border-white/5 bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-16">
          <div className="flex items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 bg-cyan-400 rounded-xl flex items-center justify-center text-sm text-black font-black">PG</div>
            <span className="heading-font font-black text-2xl tracking-widest uppercase text-white">PeptideGo Intelligence</span>
          </div>
          <div className="flex gap-12 text-xs font-black text-slate-500 uppercase tracking-[0.4em]">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="hover:text-cyan-400 transition-colors">Billing Specs</a>
            <a href="https://github.com" target="_blank" className="hover:text-cyan-400 transition-colors">Repository</a>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-slate-600 font-bold tracking-tight">
              &copy; 2025 PeptideGo. Strictly for GEO Enterprise usage.
            </p>
            <div className="flex gap-4">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Neural Link Synchronized</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
