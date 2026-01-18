
import React from 'react';
import { AuditStep } from '../types';

interface ProcessingStatusProps {
  step: AuditStep;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step }) => {
  const steps = [
    { key: AuditStep.MAPPING, label: 'Tavily Neural Map', description: 'Querying current AI reality index' },
    { key: AuditStep.FACT_CHECKING, label: 'Clinical Authority Layer', description: 'Verifying with PubMed & .gov clinical data' },
    { key: AuditStep.GAP_ANALYSIS, label: 'Hallucination Detection', description: 'Isolating misconceptions & brand omissions' },
    { key: AuditStep.GENERATING_FIX, label: 'Protocol Optimization', description: 'Drafting authoritative content injections' }
  ];

  const getCurrentIndex = () => steps.findIndex(s => s.key === step);
  const currentIndex = getCurrentIndex();

  if (step === AuditStep.IDLE || step === AuditStep.COMPLETED) return null;

  return (
    <div className="glass-panel p-8 rounded-3xl border-white/5 mt-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          Sequence Progression
        </h3>
        <span className="text-[10px] font-mono text-cyan-400 opacity-60">ID_{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
      </div>
      
      <div className="space-y-8">
        {steps.map((s, idx) => (
          <div key={s.key} className="flex gap-5 relative group">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black transition-all duration-700 ${
                idx < currentIndex ? 'bg-cyan-400 text-slate-950 scale-100 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 
                idx === currentIndex ? 'bg-slate-800 text-cyan-400 border border-cyan-400/50 animate-pulse' : 
                'bg-slate-900 border border-white/5 text-slate-600'
              }`}>
                {idx < currentIndex ? '✓' : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-[1px] h-full mt-2 transition-colors duration-1000 ${idx < currentIndex ? 'bg-cyan-400/40' : 'bg-slate-800'}`}></div>
              )}
            </div>
            <div className="pb-2">
              <h4 className={`text-xs font-bold uppercase tracking-widest mb-1 transition-colors ${idx <= currentIndex ? 'text-white' : 'text-slate-600'}`}>
                {s.label}
              </h4>
              <p className={`text-[11px] font-light leading-snug transition-colors ${idx <= currentIndex ? 'text-slate-400' : 'text-slate-700'}`}>
                {s.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProcessingStatus;
