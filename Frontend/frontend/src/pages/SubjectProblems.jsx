import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import axiosClient from '../utils/axiosClient';
import { logoutUser } from '../authSlice';
import { Code, ArrowLeft, Search, CheckCircle2, Circle, LogOut, Shield, BarChart3, AlertCircle } from 'lucide-react';

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

  const isSolved = (problemId) => solvedProblems.some((item) => item._id === problemId);

  const filteredProblems = problems.filter((problem) => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = filters.difficulty === 'all' || problem.difficulty === filters.difficulty;
    const matchesStatus = filters.status === 'all'
      || (filters.status === 'solved' && isSolved(problem._id))
      || (filters.status === 'unsolved' && !isSolved(problem._id));
    return matchesSearch && matchesDifficulty && matchesStatus;
  });

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'hard': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-stone-50 text-stone-600 border-stone-100';
    }
  };

  return (
    <div className="min-h-screen page-shell">
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavLink to="/" className="ghost-button p-2 text-stone-600">
              <ArrowLeft className="w-5 h-5" />
            </NavLink>
            <div className="brand-mark w-10 h-10 rounded-2xl flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display text-lg font-bold text-stone-950 tracking-tight">Smart Tech Lab</span>
              <p className="text-xs text-stone-500">{subjectNames[subject]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/progress" className="ghost-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-stone-700">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Progress</span>
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className="ghost-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-700">
                <Shield className="w-4 h-4" />
              </NavLink>
            )}
            <div className="flex items-center gap-2 ml-2 pl-4 border-l border-stone-200/80">
              <div className="brand-mark w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.charAt(0)?.toUpperCase()}
              </div>
              <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 page-content">
        <div className="mb-8 animate-fade-in-up">
          <div className="eyebrow-pill mb-4">Curated by subject</div>
          <h1 className="page-title text-3xl md:text-5xl font-bold mb-2">
            {subjectNames[subject] || subject}
          </h1>
          <p className="page-subtitle">
            {filteredProblems.length} {filteredProblems.length === 1 ? 'challenge' : 'challenges'} available
          </p>
        </div>

        <div className="surface-panel p-4 sm:p-5 mb-8 animate-fade-in-up stagger-1">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-luxe w-full pl-11 pr-4 py-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                className="select-luxe px-4 py-3 text-sm cursor-pointer"
              >
                <option value="all">All Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="select-luxe px-4 py-3 text-sm cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="solved">Solved</option>
                <option value="unsolved">Unsolved</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-[3px] border-stone-300 border-t-[#2147ba] rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 animate-fade-in">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
            <p className="text-stone-600">{error}</p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="surface-panel text-center py-20 animate-fade-in">
            <p className="text-stone-500 text-lg">No problems found for this subject yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProblems.map((problem, index) => (
              <NavLink
                key={problem._id}
                to={`/problem/${problem._id}`}
                className={`group flex items-center gap-4 p-5 card-professional ${index < 5 ? `animate-fade-in-up stagger-${index + 1}` : ''}`}
              >
                <div className="flex-shrink-0">
                  {isSolved(problem._id) ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-stone-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-stone-900 group-hover:text-[#2147ba] transition-colors truncate">
                    {problem.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">Open the full problem statement, code editor, and editorial.</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {problem.tags && (
                    <span className="info-chip px-3 py-1 text-xs font-semibold">
                      {problem.tags}
                    </span>
                  )}
                  <span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${getDifficultyBadge(problem.difficulty)}`}>
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
