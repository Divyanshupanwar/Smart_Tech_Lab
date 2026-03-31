import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../authSlice';
import axiosClient from '../utils/axiosClient';
import { Code, Terminal, BookOpen, Users, GraduationCap, ChevronRight, BarChart3, LogOut, Shield, ClipboardList } from 'lucide-react';

const subjectConfig = {
  DSA: {
    name: 'DSA',
    fullName: 'Data Structures & Algorithms',
    description: 'Arrays, LinkedList, Trees, Graphs, Dynamic Programming, and more',
    icon: Terminal,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    borderHover: 'hover:border-blue-200',
    badge: 'bg-blue-50 text-blue-700',
  },
  DAA: {
    name: 'DAA',
    fullName: 'Design & Analysis of Algorithms',
    description: 'Sorting, Searching, Greedy approach, Divide and Conquer, and Branch and Bound',
    icon: BookOpen,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    borderHover: 'hover:border-violet-200',
    badge: 'bg-violet-50 text-violet-700',
  },
  OOPs: {
    name: 'OOPs',
    fullName: 'Object-Oriented Programming',
    description: 'Classes, Inheritance, Polymorphism, Encapsulation, and Abstraction',
    icon: Users,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    borderHover: 'hover:border-emerald-200',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  CProgramming: {
    name: 'C Programming',
    fullName: 'C Programming Language',
    description: 'Pointers, Structures, File Handling, Functions, Loops, and Memory Management',
    icon: GraduationCap,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    borderHover: 'hover:border-amber-200',
    badge: 'bg-amber-50 text-amber-700',
  },
};

function SubjectSelection() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [subjectStats, setSubjectStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await axiosClient.get('/problem/subjectStats');
        setSubjectStats(Array.isArray(data) ? data : data?.stats || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const getStatForSubject = (subjectKey) => {
    const stat = subjectStats.find((item) => item._id === subjectKey);
    return stat ? stat.count : 0;
  };

  return (
    <div className="min-h-screen page-shell mesh-overlay">
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark w-10 h-10 rounded-2xl flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display text-lg font-bold text-stone-950 tracking-tight">Smart Tech Lab</span>
              <p className="text-xs text-stone-500">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/progress" className="ghost-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-stone-700">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">My Progress</span>
            </NavLink>
            <NavLink to="/assignments" className="ghost-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-stone-700">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Assignments</span>
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className="ghost-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-700">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </NavLink>
            )}
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-stone-200/80">
              <div className="brand-mark w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.charAt(0)?.toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-stone-900">{user?.firstName}</p>
                <p className="text-xs text-stone-500">{user?.emailID}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 page-content">
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="eyebrow-pill mb-5">Subject-centric learning</div>
          <h1 className="page-title text-4xl md:text-6xl font-extrabold mb-4">
            Choose Your <span className="gradient-text">Subject</span>
          </h1>
          <p className="page-subtitle text-lg">A brighter, cleaner coding workspace without touching your category-based layout.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-[3px] border-stone-300 border-t-[#2147ba] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {Object.entries(subjectConfig).map(([key, config], index) => {
              const Icon = config.icon;
              const problemCount = getStatForSubject(key);
              return (
                <NavLink
                  key={key}
                  to={`/subject/${key}`}
                  className={`group card-professional p-8 ${config.borderHover} animate-fade-in-up stagger-${index + 1}`}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-7 h-7 ${config.iconColor}`} />
                    </div>
                    <span className={`px-3 py-1.5 rounded-full ${config.badge} text-xs font-bold`}>
                      {problemCount} Problems
                    </span>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-stone-950 mb-2">{config.name}</h3>
                  <p className="text-stone-600 text-sm leading-relaxed mb-3">{config.fullName}</p>
                  <p className="text-stone-500 text-sm leading-relaxed mb-6">{config.description}</p>

                  <div className="flex items-center gap-2 text-sm font-bold text-[#2147ba] group-hover:gap-3 transition-all">
                    Start Learning
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubjectSelection;
