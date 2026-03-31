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

  const heroHighlights = [
    'Subject-first problem navigation',
    'Judge-backed coding evaluation',
    'Assignments and video editorials',
  ];

  return (
    <div className="min-h-screen page-shell mesh-overlay">
      <nav className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark w-10 h-10 rounded-2xl flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-stone-950 tracking-tight">Smart Tech Lab</span>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/login" className="ghost-button px-5 py-2.5 text-sm font-semibold text-stone-700">
              Login
            </NavLink>
            <NavLink to="/signup" className="btn-professional">
              Get Started <ArrowRight className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </nav>

      <section className="hero-stage pt-32 pb-20 px-6 page-content min-h-[92vh] flex items-center">
        <div className="max-w-7xl mx-auto text-center w-full">
          <div className="animate-fade-in-up">
            <div className="eyebrow-pill mb-8">
              <Zap className="w-4 h-4" />
              University Coding Lab Platform
            </div>
            <h1 className="page-title text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
              Master Coding Through
              <span className="gradient-text block mt-2">Practice and Precision</span>
            </h1>
            <p className="page-subtitle text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              A comprehensive platform for learning and practicing programming concepts with hands-on challenges across DSA, DAA, OOPs, and C Programming.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up stagger-2">
            <NavLink to="/signup" className="group btn-professional text-base px-8 py-4">
              Start Learning Free
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </NavLink>
            <NavLink to="/login" className="ghost-button px-8 py-4 rounded-2xl font-semibold text-base text-stone-800">
              Sign In
            </NavLink>
          </div>

          <div className="mt-16 mx-auto max-w-5xl surface-panel p-4 sm:p-6 animate-fade-in-up stagger-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {heroHighlights.map((item) => (
                <div key={item} className="rounded-2xl border border-stone-200/80 bg-white/75 px-5 py-4 text-left">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 w-5 h-5 text-[#2147ba]" />
                    <p className="text-sm font-semibold text-stone-800">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 section-muted page-content">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="page-title text-3xl md:text-4xl font-bold mb-4">Four Core Subjects</h2>
            <p className="page-subtitle text-lg">Master the fundamentals of computer science</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {subjects.map((sub, i) => {
              const Icon = sub.icon;
              return (
                <div key={sub.key} className={`card-professional p-8 animate-fade-in-up stagger-${i + 1}`}>
                  <div className={`w-14 h-14 rounded-2xl ${sub.color} border flex items-center justify-center mb-6`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-stone-950 mb-2">{sub.key}</h3>
                  <p className="text-stone-600 text-sm leading-relaxed">{sub.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 page-content">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className={`text-center p-8 card-professional animate-fade-in-up stagger-${i + 1}`}>
                  <div className="w-16 h-16 rounded-2xl bg-stone-950/5 flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-[#2147ba]" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-stone-950 mb-3">{feature.title}</h3>
                  <p className="text-stone-600 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 page-content">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center surface-panel p-8 md:p-10">
          {[
            { val: '4', label: 'Core Subjects' },
            { val: '50+', label: 'Coding Problems' },
            { val: '3', label: 'Languages' },
            { val: '24/7', label: 'AI Assistance' },
          ].map((stat) => (
            <div key={stat.label} className="animate-fade-in-up">
              <p className="font-display text-4xl font-extrabold text-stone-950 mb-1">{stat.val}</p>
              <p className="text-stone-500 text-sm font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-stone-200/80 py-12 px-6 bg-transparent page-content">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark w-8 h-8 rounded-xl flex items-center justify-center">
              <Code className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-sm font-semibold text-stone-700">Smart Tech Lab</span>
          </div>
          <p className="text-sm text-stone-500">Copyright 2026 Smart Tech Lab. Built for university students.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
