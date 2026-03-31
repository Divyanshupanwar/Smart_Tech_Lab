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
    easy: { total: allProblems.filter(p => p.difficulty === 'easy').length, solved: solvedProblems.filter(p => p.difficulty === 'easy').length },
    medium: { total: allProblems.filter(p => p.difficulty === 'medium').length, solved: solvedProblems.filter(p => p.difficulty === 'medium').length },
    hard: { total: allProblems.filter(p => p.difficulty === 'hard').length, solved: solvedProblems.filter(p => p.difficulty === 'hard').length },
  };

  const subjectBreakdown = ['DSA', 'DAA', 'OOPs', 'CProgramming'].map(sub => ({
    subject: sub,
    total: allProblems.filter(p => p.subject === sub).length,
    solved: solvedProblems.filter(p => p.subject === sub).length,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
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
              <span className="text-lg font-bold text-slate-900">My Progress</span>
              <p className="text-xs text-slate-400">Track your learning journey</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.firstName?.charAt(0)?.toUpperCase()}
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in-up">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card-professional p-6 text-center">
                <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                <h3 className="text-3xl font-extrabold text-slate-900">{solvedCount}</h3>
                <p className="text-sm text-slate-500 mt-1">Problems Solved</p>
              </div>
              <div className="card-professional p-6 text-center">
                <Target className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                <h3 className="text-3xl font-extrabold text-slate-900">{totalProblems}</h3>
                <p className="text-sm text-slate-500 mt-1">Total Problems</p>
              </div>
              <div className="card-professional p-6 text-center">
                <BarChart3 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-3xl font-extrabold text-slate-900">{progressPercent}%</h3>
                <p className="text-sm text-slate-500 mt-1">Completion Rate</p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="card-professional p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Overall Progress</h3>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">{solvedCount} out of {totalProblems} problems completed</p>
            </div>

            {/* Difficulty Breakdown */}
            <div className="card-professional p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">By Difficulty</h3>
              <div className="grid grid-cols-3 gap-4">
                {['easy', 'medium', 'hard'].map(level => {
                  const bd = difficultyBreakdown[level];
                  const pct = bd.total > 0 ? Math.round((bd.solved / bd.total) * 100) : 0;
                  const colors = { easy: 'bg-emerald-500', medium: 'bg-amber-500', hard: 'bg-red-500' };
                  return (
                    <div key={level} className="text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{level}</p>
                      <p className="text-xl font-bold text-slate-900">{bd.solved}/{bd.total}</p>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div className={`h-full ${colors[level]} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subject Breakdown */}
            <div className="card-professional p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">By Subject</h3>
              <div className="space-y-4">
                {subjectBreakdown.map(({ subject, total, solved }) => {
                  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
                  return (
                    <div key={subject}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700">{subject}</span>
                        <span className="text-xs text-slate-400">{solved}/{total}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Solved Problems List */}
            <div className="card-professional p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Solved Problems</h3>
              {solvedProblems.length === 0 ? (
                <p className="text-slate-400 text-sm">You haven't solved any problems yet. Start practicing!</p>
              ) : (
                <div className="space-y-2">
                  {solvedProblems.map(problem => (
                    <NavLink
                      key={problem._id}
                      to={`/problem/${problem._id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{problem.title}</span>
                      <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-md ${
                        problem.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' :
                        problem.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' :
                        'bg-red-50 text-red-600'
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
