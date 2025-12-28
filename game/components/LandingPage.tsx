import React from 'react';
import { Play, Heart, Hammer, Users, Github, Code2, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onPlay: () => void;
  onAbout: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onPlay, onAbout }) => {
  return (
    <div className="w-full h-screen bg-slate-900 text-white overflow-y-auto scroll-smooth">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                TATCHAMASHAY
              </h1>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <button 
                  onClick={onAbout}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  About
                </button>
                <button
                  onClick={onPlay}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30"
                >
                  Play Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background with overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105"
          style={{ 
            backgroundImage: 'url(/textures/forest_panorama.png)',
            filter: 'blur(4px) brightness(0.4)'
          }}
        />
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
            <Sparkles size={16} className="text-yellow-400 animate-pulse" />
            <span className="text-sm font-medium text-yellow-100">Welcome to the adventure</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight drop-shadow-2xl">
            Create, Play, and <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Vibe Together
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-200 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            A multiplayer adventure built by kids and parents, for kids and parents.
            Jump into a world of imagination.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onPlay}
              className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white text-xl font-bold py-4 px-10 rounded-2xl shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/40"
            >
              <Play fill="currentColor" size={24} />
              Start Adventure
            </button>
            <button
              onClick={onAbout}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-lg font-semibold py-4 px-8 rounded-2xl backdrop-blur-md transition-all border border-white/10"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Floating gradient orbs for effect */}
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Value Proposition Block */}
      <section className="py-20 bg-slate-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 md:p-16 relative overflow-hidden shadow-2xl border border-white/10">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
            
            <div className="relative z-10 text-center">
              <Code2 size={48} className="mx-auto text-purple-300 mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Learn how to vibe code and experiment<br/>with new tools with your kids.
              </h2>
              <p className="text-lg text-purple-200 max-w-2xl mx-auto">
                Tatchamashay isn't just a game—it's a playground for creativity and learning.
                Built using modern web technologies, it's a perfect example of what's possible
                when curiosity meets code.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="about" className="py-20 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Why Tatchamashay?</h2>
            <div className="h-1 w-20 bg-purple-500 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Heart className="text-pink-500" size={32} />}
              title="Built with Love"
              description="A collaborative project built by kids and their parents, bringing generations together through code and play."
            />
            <FeatureCard 
              icon={<Hammer className="text-yellow-500" size={32} />}
              title="Create Levels"
              description="Design your own worlds. From sunny balloon lands to crystal caverns, the only limit is your imagination."
            />
            <FeatureCard 
              icon={<Users className="text-green-500" size={32} />}
              title="Custom Characters"
              description="Create your own unique characters. Be a wizard, a warrior, or a fluffy unicorn!"
            />
            <FeatureCard 
              icon={<Github className="text-white" size={32} />}
              title="Open Source"
              description="Contribute to the community. The game is open for everyone to learn from and build upon."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-white mb-2">TATCHAMASHAY</h3>
            <p className="text-slate-400 text-sm">© 2025 Tatchamashay Team. All rights reserved.</p>
          </div>
          <div className="flex gap-6">
            <a href="https://github.com/joshuabroggi/tatchamashay" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="bg-slate-800 p-8 rounded-2xl hover:bg-slate-750 transition-all hover:-translate-y-2 border border-white/5 shadow-lg">
    <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mb-6 shadow-inner">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">
      {description}
    </p>
  </div>
);

