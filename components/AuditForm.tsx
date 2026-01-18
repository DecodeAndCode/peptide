
import React, { useState } from 'react';
import { AuditRequest } from '../types';

interface AuditFormProps {
  onStart: (req: AuditRequest) => void;
  isLoading: boolean;
}

const AuditForm: React.FC<AuditFormProps> = ({ onStart, isLoading }) => {
  const [url, setUrl] = useState('https://www.madebythrone.com/');
  const [goal, setGoal] = useState('Acne / pimples');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ brandUrl: url, healthGoal: goal });
  };

  const suggestions = [
    "Acne / pimples",
    "Hair / scalp rejuvenation"
  ];

  return (
    <div className="glass-panel rounded-3xl overflow-hidden glow-cyan border-cyan-400/20 shadow-2xl">
      <div className="bg-slate-950/80 px-8 py-6 border-b border-white/5">
        <h2 className="heading-font text-lg font-bold text-white flex items-center gap-3">
          <span className="w-1.5 h-4 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]"></span>
          Intelligence Terminal
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-cyan-400/60 uppercase tracking-widest pl-1">Target Brand Domain</label>
          <div className="relative group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-950/50 px-4 py-4 rounded-xl border border-white/10 text-white focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all outline-none font-mono text-sm group-hover:border-white/20"
              placeholder="https://brand-domain.com"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-cyan-400/60 uppercase tracking-widest pl-1">Primary Clinical Vertical</label>
          <div className="relative group">
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-slate-950/50 px-4 py-4 rounded-xl border border-white/10 text-white focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all outline-none text-sm group-hover:border-white/20 appearance-none"
            >
              {suggestions.map(s => <option key={s} value={s} className="bg-slate-950 text-white">{s}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setGoal(s)}
                className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md border transition-all active:scale-95 ${
                  goal === s 
                  ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400' 
                  : 'bg-white/5 text-slate-400 border-white/5 hover:border-cyan-400/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-5 rounded-2xl font-bold uppercase tracking-widest text-[11px] transition-all shadow-xl group relative overflow-hidden ${
            isLoading 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:scale-[1.02] active:scale-95 shadow-cyan-400/10'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Neural Audit Active...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Begin GEO Audit Sequence
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </span>
          )}
        </button>
      </form>
    </div>
  );
};

export default AuditForm;
