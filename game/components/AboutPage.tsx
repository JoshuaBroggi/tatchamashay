import React from 'react';
import { ArrowLeft, ExternalLink, Download, Github, Mic, Gamepad2, Sparkles } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
    <div className="w-full h-screen bg-slate-900 text-white overflow-y-auto">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20">
            <button 
              onClick={() => {
                onBack();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                TATCHAMASHAY
              </h1>
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Sparkles size={16} className="text-emerald-400" />
            <span className="text-sm font-medium text-emerald-200">Quick Start Guide</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6">
            Start Your Adventure
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Follow these simple steps to set up your development environment and start creating in the world of Tatchamashay.
          </p>
        </div>

        <div className="space-y-8">
          {/* Step 1: Cursor */}
          <StepCard 
            number={1}
            title="Download Cursor"
            description="The AI-first code editor that helps you build faster."
            link="https://cursor.com"
            linkText="Get Cursor"
            icon={<Download className="text-teal-400" size={24} />}
          />

          {/* Step 2: Github */}
          <StepCard 
            number={2}
            title="Clone the Repo"
            description="Get the game code on your computer to start exploring."
            link="https://github.com/joshuabroggi/tatchamashay"
            linkText="View on GitHub"
            icon={<Github className="text-white" size={24} />}
            code="git clone https://github.com/joshuabroggi/tatchamashay.git"
          />

          {/* Step 3: AI Models */}
          <StepCard 
            number={3}
            title="Choose Your AI Assistant"
            description="Use Opus 4.5 ($) or Grok (free) for the best coding experience. These models are fast, intelligent, and great at understanding game logic."
            icon={<Sparkles className="text-amber-400" size={24} />}
          />

          {/* Step 4: Voice Dictation */}
          <StepCard 
            number={4}
            title="Voice Dictation"
            description="We use Wispr Flow for kid's voice dictation. It's an amazing tool that makes coding accessible for younger creators!"
            link="https://wisprflow.ai"
            linkText="Try Wispr Flow"
            icon={<Mic className="text-emerald-400" size={24} />}
          />

          {/* Step 5: 3D Characters */}
          <StepCard 
            number={5}
            title="Create Characters"
            description="Use Tripo3D to generate custom 3D characters for free. If you want them to walk or move with animation, you'll need to 'rig' them (paid feature)."
            link="https://studio.tripo3d.ai"
            linkText="Visit Tripo3D Studio"
            icon={<Gamepad2 className="text-indigo-400" size={24} />}
          />
        </div>

        {/* Footer Note */}
        <div className="mt-16 p-6 bg-slate-800/50 rounded-2xl border border-white/5 text-center">
          <p className="text-gray-400">
            Need help? Check out our <a href="https://github.com/joshuabroggi/tatchamashay" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">documentation</a> or join the community.
          </p>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-slate-950 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-white">TATCHAMASHAY</h3>
          </div>
          <div className="flex gap-6">
            <a href="https://github.com/joshuabroggi/tatchamashay" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <Github size={16} />
              GitHub
            </a>
            <a href="https://chat.whatsapp.com/CsvnPZmVz1eGAlXRwTuDOW" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <span className="text-lg">💬</span>
              Community
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
  icon: React.ReactNode;
  code?: string;
}

const StepCard: React.FC<StepCardProps> = ({ number, title, description, link, linkText, icon, code }) => (
  <div className="bg-slate-800 p-6 md:p-8 rounded-2xl border border-white/5 shadow-lg transition-all hover:bg-slate-750 hover:border-white/10 group">
    <div className="flex items-start gap-6">
      <div className="flex-shrink-0 w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5 group-hover:border-emerald-500/30 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">
            {number}
          </span>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 leading-relaxed mb-4">
          {description}
        </p>
        
        {code && (
          <div className="bg-slate-950 p-3 rounded-lg border border-white/5 font-mono text-sm text-gray-300 mb-4 overflow-x-auto">
            {code}
          </div>
        )}

        {link && (
          <a 
            href={link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            {linkText || 'Learn more'} 
            <ExternalLink size={16} />
          </a>
        )}
      </div>
    </div>
  </div>
);

