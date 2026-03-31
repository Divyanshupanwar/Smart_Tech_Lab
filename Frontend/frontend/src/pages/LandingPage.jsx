import { NavLink } from 'react-router';
import { Code, BookOpen, Trophy, Users, ChevronRight, Terminal, Zap, GraduationCap, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

function LandingPage() {
  const features = [
    { icon: Terminal, title: 'Interactive Coding', desc: 'Write, run, and submit code with real-time feedback from Judge0' },
    { icon: Trophy, title: 'Track Progress', desc: 'Monitor your learning journey across all subjects with detailed analytics' },
    { icon: Sparkles, title: 'AI Assistance', desc: 'Get intelligent hints and code reviews from our AI-powered coding tutor' },
  ];

  const subjects = [
    { key: 'DSA', name: 'Data Structures & Algorithms', desc: 'Arrays, Trees, Graphs, Dynamic Programming', icon: Terminal, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { key: 'DAA', name: 'Design & Analysis of Algorithms', desc: 'Sorting, Greedy, Divide & Conquer', icon: BookOpen, color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { key: 'OOPs', name: 'Object-Oriented Programming', desc: 'Classes, Inheritance, Polymorphism', icon: Users, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { key: 'CProgramming', name: 'C Programming', desc: 'Pointers, Structures, File Handling', icon: GraduationCap, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Code className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Smart Tech Lab</span>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/login" className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-50">
              Login
            </NavLink>
            <NavLink to="/signup" className="btn-professional flex items-center gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              University Coding Lab Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
              Master Coding Through
              <span className="gradient-text block mt-2">Practice & Precision</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              A comprehensive platform for learning and practicing programming concepts with hands-on challenges across DSA, DAA, OOPs, and C Programming.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up stagger-2">
            <NavLink to="/signup" className="group btn-professional flex items-center gap-2 text-base px-8 py-4">
              Start Learning Free
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </NavLink>
            <NavLink to="/login" className="px-8 py-4 border border-slate-200 text-slate-700 rounded-xl font-semibold text-base hover:bg-slate-50 hover:border-slate-300 transition-all">
              Sign In
            </NavLink>
          </div>
        </div>
      </section>

      {/* Subjects Preview */}
      <section className="py-20 px-6 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Four Core Subjects</h2>
            <p className="text-slate-500 text-lg">Master the fundamentals of computer science</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {subjects.map((sub, i) => {
              const Icon = sub.icon;
              return (
                <div key={sub.key} className={`card-professional p-8 animate-fade-in-up stagger-${i+1}`}>
                  <div className={`w-14 h-14 rounded-2xl ${sub.color} border flex items-center justify-center mb-6`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{sub.key}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{sub.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className={`text-center p-8 card-professional animate-fade-in-up stagger-${i+1}`}>
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-indigo-600">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: '4', label: 'Core Subjects' },
            { val: '50+', label: 'Coding Problems' },
            { val: '3', label: 'Languages' },
            { val: '24/7', label: 'AI Assistance' },
          ].map((s, i) => (
            <div key={i} className="animate-fade-in-up">
              <p className="text-4xl font-extrabold text-white mb-1">{s.val}</p>
              <p className="text-indigo-200 text-sm font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Code className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-600">Smart Tech Lab</span>
          </div>
          <p className="text-sm text-slate-400">© 2026 Smart Tech Lab. Built for university students.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
