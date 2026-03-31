import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import axiosClient from '../utils/axiosClient';
import { logoutUser } from '../authSlice';
import { Code, ArrowLeft, Trophy, Target, CheckCircle2, LogOut, BarChart3 } from 'lucide-react';

function UserProgress() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  const extractProblems = (payload) => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.problems)) {
      return payload.problems;
    }

    return [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [solvedRes, allRes] = await Promise.all([
          axiosClient.get('/problem/problemSolvedbyUser'),
          axiosClient.get('/problem/getAllProblem'),
        ]);
        setSolvedProblems(extractProblems(solvedRes.data));
        setAllProblems(extractProblems(allRes.data));
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => dispatch(logoutUser());

  const totalProblems = allProblems.length;
  const solvedCount = solvedProblems.length;
  const progressPercent = totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0;

  const difficultyBreakdown = {
    easy: { total: allProblems.filter((problem) => problem.difficulty === 'easy').length, solved: solvedProblems.filter((problem) => problem.difficulty === 'easy').length },
    medium: { total: allProblems.filter((problem) => problem.difficulty === 'medium').length, solved: solvedProblems.filter((problem) => problem.difficulty === 'medium').length },
    hard: { total: allProblems.filter((problem) => problem.difficulty === 'hard').length, solved: solvedProblems.filter((problem) => problem.difficulty === 'hard').length },
  };

  const subjectBreakdown = ['DSA', 'DAA', 'OOPs', 'CProgramming'].map((subject) => ({
    subject,
    total: allProblems.filter((problem) => problem.subject === subject).length,
    solved: solvedProblems.filter((problem) => problem.subject === subject).length,
  }));

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
              <span className="font-display text-lg font-bold text-stone-950">My Progress</span>
              <p className="text-xs text-stone-500">Track your learning journey</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="brand-mark w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold text-sm">
              {user?.firstName?.charAt(0)?.toUpperCase()}
            </div>
            <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 page-content">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-[3px] border-stone-300 border-t-[#2147ba] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in-up">
            <div>
              <div className="eyebrow-pill mb-4">Performance overview</div>
              <h1 className="page-title text-4xl font-bold mb-2">Progress Dashboard</h1>
              <p className="page-subtitle">The same brighter visual system now carries across your analytics pages too.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card-professional p-6 text-center">
                <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                <h3 className="font-display text-3xl font-extrabold text-stone-950">{solvedCount}</h3>
                <p className="text-sm text-stone-500 mt-1">Problems Solved</p>
              </div>
              <div className="card-professional p-6 text-center">
                <Target className="w-8 h-8 text-[#2147ba] mx-auto mb-3" />
                <h3 className="font-display text-3xl font-extrabold text-stone-950">{totalProblems}</h3>
                <p className="text-sm text-stone-500 mt-1">Total Problems</p>
              </div>
              <div className="card-professional p-6 text-center">
                <BarChart3 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                <h3 className="font-display text-3xl font-extrabold text-stone-950">{progressPercent}%</h3>
                <p className="text-sm text-stone-500 mt-1">Completion Rate</p>
              </div>
            </div>

            <div className="card-professional p-6">
              <h3 className="text-sm font-bold text-stone-900 mb-4">Overall Progress</h3>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #111111 0%, #2147ba 70%, #c77b30 100%)' }}
                />
              </div>
              <p className="text-xs text-stone-500 mt-2">{solvedCount} out of {totalProblems} problems completed</p>
            </div>

            <div className="card-professional p-6">
              <h3 className="text-sm font-bold text-stone-900 mb-4">By Difficulty</h3>
              <div className="grid grid-cols-3 gap-4">
                {['easy', 'medium', 'hard'].map((level) => {
                  const breakdown = difficultyBreakdown[level];
                  const pct = breakdown.total > 0 ? Math.round((breakdown.solved / breakdown.total) * 100) : 0;
                  const colors = { easy: '#059669', medium: '#d97706', hard: '#dc2626' };
                  return (
                    <div key={level} className="text-center">
                      <p className="text-xs font-bold text-stone-500 uppercase mb-2">{level}</p>
                      <p className="font-display text-xl font-bold text-stone-950">{breakdown.solved}/{breakdown.total}</p>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mt-2">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: colors[level] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-professional p-6">
              <h3 className="text-sm font-bold text-stone-900 mb-4">By Subject</h3>
              <div className="space-y-4">
                {subjectBreakdown.map(({ subject, total, solved }) => {
                  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
                  return (
                    <div key={subject}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-stone-700">{subject}</span>
                        <span className="text-xs text-stone-500">{solved}/{total}</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2147ba] rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-professional p-6">
              <h3 className="text-sm font-bold text-stone-900 mb-4">Solved Problems</h3>
              {solvedProblems.length === 0 ? (
                <p className="text-stone-500 text-sm">You have not solved any problems yet. Start practicing.</p>
              ) : (
                <div className="space-y-2">
                  {solvedProblems.map((problem) => (
                    <NavLink
                      key={problem._id}
                      to={`/problem/${problem._id}`}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-stone-50 transition-colors group"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-stone-700 group-hover:text-[#2147ba] transition-colors">{problem.title}</span>
                      <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${
                        problem.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                        problem.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>{problem.difficulty}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProgress;
