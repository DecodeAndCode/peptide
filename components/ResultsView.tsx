
import React from 'react';
import { AuditResult, Citation } from '../types';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ResultsViewProps {
  result: AuditResult;
}

const FormattedText: React.FC<{ text: string, isDark?: boolean, sizeClass?: string }> = ({ text, isDark = true, sizeClass }) => {
  if (!text) return null;
  const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "");
  const parts = cleanText.split(/(\*\*.*?\*\*)/g);
  return (
    <div className={`whitespace-pre-line ${sizeClass || ''}`}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong 
              key={i} 
              className={`font-bold ${
                isDark 
                ? 'text-cyan-400' 
                : 'text-slate-950 decoration-cyan-500 underline underline-offset-4'
              }`}
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </div>
  );
};

const SectionCitations: React.FC<{ citations: Citation[], filter?: string, brandUrl?: string }> = ({ citations, filter, brandUrl }) => {
  const filtered = citations.filter(c => {
    const isBrand = brandUrl && c.url.includes(new URL(brandUrl).hostname);
    if (isBrand) return true;
    if (!filter) return true;
    return c.url.toLowerCase().includes(filter.toLowerCase());
  });

  if (filtered.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-white/10">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-4">Authority Grounding</span>
      <div className="flex flex-wrap gap-3">
        {filtered.map((cite, i) => (
          <a 
            key={i} 
            href={cite.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[11px] px-4 py-2 bg-slate-900 border border-white/5 hover:border-cyan-400/50 text-slate-300 hover:text-white rounded-xl transition-all shadow-lg flex items-center gap-2"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cite.url.includes(brandUrl || '') ? 'bg-cyan-400' : 'bg-blue-500'}`}></span>
            {new URL(cite.url).hostname}
          </a>
        ))}
      </div>
    </div>
  );
};

const ResultsView: React.FC<ResultsViewProps> = ({ result }) => {
  const analyticsData = [
    { name: 'Accuracy', value: result.analytics.accuracyScore, color: '#22d3ee' },
    { name: 'Mismatch', value: result.analytics.mismatchScore, color: '#f43f5e' },
    { name: 'Gaps', value: result.analytics.unverifiableScore, color: '#64748b' },
  ];

  const brandUrl = result.citations[0]?.url;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.theFix);
    alert('GEO Content Protocol copied to clipboard.');
  };

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both pb-40">
      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        <div className="md:col-span-7 glass-panel p-10 rounded-[3rem] border-white/5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 blur-[80px] rounded-full"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-10">
              <div className="w-3 h-14 bg-cyan-400 rounded-full shadow-[0_0_20px_#22d3ee]"></div>
              <div>
                <h3 className="heading-font text-4xl font-black text-white tracking-tighter leading-none">Intelligence Audit</h3>
                <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 font-bold mt-2">Peptide Authority Protocol</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-8">
              <MetricBox label="Accuracy Index" value={`${result.analytics.accuracyScore}%`} sub="Verified Truth" color="text-cyan-400" />
              <MetricBox label="Mismatch Risk" value={`${result.analytics.mismatchScore}%`} sub="Hallucination Risk" color="text-rose-500" />
              <MetricBox label="Citations" value={result.citations.length.toString()} sub="Verified Refs" color="text-white" />
            </div>
          </div>
        </div>
        
        <div className="md:col-span-5 glass-panel p-8 rounded-[3rem] border-rose-500/30 bg-rose-500/[0.03] shadow-[0_0_50px_rgba(244,63,94,0.1)] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                Mismatch Analytics
              </h4>
              <span className="text-[10px] font-mono text-slate-500">PROTOCOL_SYNC_9.5</span>
            </div>
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData}>
                  <XAxis dataKey="name" hide />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {analyticsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-8 p-5 rounded-2xl bg-slate-950/50 border border-rose-500/20">
            <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
              <strong className="text-rose-500 uppercase tracking-tighter mr-2 font-black">Critical Insight:</strong> 
              Mismatch of {result.analytics.mismatchScore}% suggests AI models are hallucinating non-topical products (e.g. injectables) not found on your domain.
            </p>
          </div>
        </div>
      </div>

      {/* Main Analysis Cards */}
      <div className="grid grid-cols-1 gap-10">
        <ReportCard 
          title="Current AI Reality" 
          subtitle="How LLMs Currently See Your Brand"
          content={result.currentAiReality} 
          icon={<RealityIcon />}
          citations={result.citations}
        />
        
        <ReportCard 
          title="The Authority Truth" 
          subtitle="Topical Peptide Comparison"
          content={result.authorityTruth} 
          icon={<TruthIcon />}
          status="GROUNDED"
          filter="gov|mayoclinic|cleveland|webmd"
          brandUrl={brandUrl}
          citations={result.citations}
        />
        
        <ReportCard 
          title="Hallucination / Omission" 
          subtitle="Isolating AI Knowledge Failures"
          content={result.hallucinationOmission} 
          icon={<AlertIcon />}
          variant="risk"
          citations={result.citations}
        />
      </div>

      {/* The PeptideGo Fix Protocol */}
      <div className="bg-slate-950 rounded-[4rem] border-4 border-cyan-400 p-1 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent)] shadow-[0_0_80px_rgba(34,211,238,0.15)]">
        <div className="bg-white rounded-[3.8rem] p-12 lg:p-16 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-[0.05] pointer-events-none">
            <svg className="w-96 h-96 text-slate-900" fill="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-14 gap-8">
              <div>
                <h3 className="heading-font text-5xl font-black text-slate-950 tracking-tighter mb-2">The PeptideGo Fix</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                  <span className="w-8 h-px bg-slate-300"></span>
                  Proprietary GEO Injection
                </p>
              </div>
              <button 
                onClick={copyToClipboard}
                className="px-14 py-6 bg-slate-950 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-4 hover:bg-cyan-600"
              >
                Copy Protocol Copy
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              </button>
            </div>
            
            <div className="bg-slate-50 border-l-[16px] border-cyan-500 p-12 rounded-r-[3rem] shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] mb-12">
              <div className="text-2xl font-bold text-slate-800 leading-[1.6] italic">
                <FormattedText text={result.theFix} isDark={false} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
              {/* Strategic Advice Section - MAX READABILITY & PARSED MARKDOWN */}
              <div className="bg-cyan-50 p-12 lg:p-16 rounded-[4rem] border border-cyan-200 shadow-sm relative">
                <div className="absolute top-0 right-10 -translate-y-1/2">
                   <div className="px-6 py-3 bg-cyan-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Strategic Insight</div>
                </div>
                <h4 className="text-base font-black text-cyan-800 uppercase tracking-[0.3em] mb-10 flex items-center gap-5">
                  <div className="p-4 bg-cyan-500 text-white rounded-2xl shadow-cyan-400/20 shadow-xl">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM14.5 9a2.5 2.5 0 00-5 0v5a2.5 2.5 0 005 0V9z" /></svg>
                  </div>
                  Strategic Implementation Advice
                </h4>
                <div className="bg-white/70 p-12 rounded-[3.5rem] border border-cyan-200/50 shadow-inner italic">
                  <FormattedText 
                    text={result.geoImplementationNotes} 
                    isDark={false} 
                    sizeClass="text-2xl lg:text-3xl font-bold text-cyan-950 leading-[1.5]"
                  />
                </div>
              </div>
              
              <div className="bg-slate-100 p-12 rounded-[4rem] border border-slate-200">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Clinical Authority Sources</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                  {result.citations.map((cite, i) => (
                    <a key={i} href={cite.url} target="_blank" className="flex items-center justify-between group p-5 bg-white rounded-2xl border border-slate-200 hover:border-cyan-400 transition-all shadow-md">
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <span className="text-sm font-bold text-slate-800 truncate">{cite.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{new URL(cite.url).hostname}</span>
                      </div>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-cyan-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, sub, color }: { label: string, value: string, sub: string, color: string }) => (
  <div className="space-y-1 group cursor-default">
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</div>
    <div className={`text-5xl font-black tracking-tighter transition-all group-hover:translate-y-[-2px] ${color}`}>{value}</div>
    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-tight">{sub}</div>
  </div>
);

const ReportCard = ({ title, subtitle, content, icon, variant = 'default', status, citations, filter, brandUrl }: { 
  title: string, 
  subtitle: string, 
  content: string, 
  icon: React.ReactNode, 
  variant?: 'default' | 'risk',
  status?: string,
  citations: Citation[],
  filter?: string,
  brandUrl?: string
}) => (
  <div className={`glass-panel p-10 lg:p-14 rounded-[3.5rem] border transition-all duration-700 ${
    variant === 'risk' ? 'border-rose-500/20 bg-rose-500/[0.03] hover:border-rose-500/40' : 'border-white/5 hover:border-cyan-400/30'
  }`}>
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
      <div className="flex items-center gap-6">
        <div className={`p-5 rounded-3xl shadow-2xl ${variant === 'risk' ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-400/10 text-cyan-400'}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-3xl font-black text-white tracking-tighter leading-none mb-1">{title}</h3>
          <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.3em]">{subtitle}</p>
        </div>
      </div>
      {status && (
        <div className="px-6 py-2 bg-green-400/10 text-green-400 rounded-full text-[10px] font-black tracking-[0.3em] border border-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.05)] self-start md:self-center">
          {status}
        </div>
      )}
    </div>
    
    <div className="text-slate-400 text-lg font-light leading-relaxed mb-10">
      <FormattedText text={content} isDark={true} />
    </div>

    <SectionCitations citations={citations} filter={filter} brandUrl={brandUrl} />
  </div>
);

const RealityIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const TruthIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const AlertIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

export default ResultsView;
