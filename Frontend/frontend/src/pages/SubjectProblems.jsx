import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import axiosClient from '../utils/axiosClient';
import { logoutUser } from '../authSlice';
import { Code, ArrowLeft, Search, CheckCircle2, Circle, LogOut, Shield, BarChart3, ClipboardList, Filter, AlertCircle } from 'lucide-react';

const subjectNames = {
  DSA: 'Data Structures & Algorithms',
  DAA: 'Design & Analysis of Algorithms',
  OOPs: 'Object-Oriented Programming',
  CProgramming: 'C Programming',
};

const extractProblems = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.problems)) {
    return payload.problems;
  }

  return [];
};

function SubjectProblems() {
  const { subject } = useParams();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [problems, setProblems] = useState([]);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    difficulty: 'all',
    status: 'all',
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [problemsRes, solvedRes] = await Promise.all([
          axiosClient.get(`/problem/bySubject/${subject}`),
          axiosClient.get('/problem/problemSolvedbyUser'),
        ]);
        setProblems(extractProblems(problemsRes.data));
        setSolvedProblems(extractProblems(solvedRes.data));
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || 'Failed to load problems. Please try again.');
        setProblems([]);
        setSolvedProblems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [subject]);

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const isSolved = (problemId) => {
    return solvedProblems.some(sp => sp._id === problemId);
  };

  const filteredProblems = problems.filter(problem => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = filters.difficulty === 'all' || problem.difficulty === filters.difficulty;
    const matchesStatus = filters.status === 'all' ||
      (filters.status === 'solved' && isSolved(problem._id)) ||
      (filters.status === 'unsolved' && !isSolved(problem._id));
    return matchesSearch && matchesDifficulty && matchesStatus;
  });

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'hard': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavLink to="/" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5" />
            </NavLink>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">Smart Tech Lab</span>
              <p className="text-xs text-slate-400">{subjectNames[subject]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/progress" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Progress</span>
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-xl transition-all">
                <Shield className="w-4 h-4" />
              </NavLink>
            )}
            <div className="flex items-center gap-2 ml-2 pl-4 border-l border-slate-200">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.charAt(0)?.toUpperCase()}
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {subjectNames[subject] || subject}
          </h1>
          <p className="text-slate-500">
            {filteredProblems.length} {filteredProblems.length === 1 ? 'challenge' : 'challenges'} available
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 animate-fade-in-up stagger-1">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm cursor-pointer focus:outline-none focus:border-indigo-400 transition-all"
            >
              <option value="all">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm cursor-pointer focus:outline-none focus:border-indigo-400 transition-all"
            >
              <option value="all">All Status</option>
              <option value="solved">Solved</option>
              <option value="unsolved">Unsolved</option>
            </select>
          </div>
        </div>

        {/* Problems List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 animate-fade-in">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
            <p className="text-slate-500">{error}</p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <p className="text-slate-400 text-lg">No problems found for this subject yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProblems.map((problem, index) => (
              <NavLink
                key={problem._id}
                to={`/problem/${problem._id}`}
                className={`group flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200 animate-fade-in-up stagger-${Math.min(index+1, 5)}`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {isSolved(problem._id) ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300" />
                  )}
                </div>

                {/* Problem Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                    {problem.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Click to view problem details</p>
                </div>

                {/* Tags & Difficulty */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {problem.tags && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-xs font-medium border border-slate-100">
                      {problem.tags}
                    </span>
                  )}
                  <span className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${getDifficultyBadge(problem.difficulty)}`}>
                    {problem.difficulty?.charAt(0).toUpperCase() + problem.difficulty?.slice(1)}
                  </span>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubjectProblems;
