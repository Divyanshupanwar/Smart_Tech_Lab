import { useEffect, useState } from 'react';
import axiosClient from '../utils/axiosClient';
import { NavLink } from 'react-router';
import { ArrowLeft, Code, Upload, Trash2, AlertTriangle } from 'lucide-react';

const AdminVideo = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/problem/getAllProblem');
      setProblems(extractProblems(data));
    } catch (err) {
      setError('Failed to fetch problems');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await axiosClient.delete(`/video/delete/${id}`);
      fetchProblems();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete video');
      console.error(err);
    }
  };

  const getDifficultyBadge = (d) => {
    switch (d?.toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-600';
      case 'medium': return 'bg-amber-50 text-amber-600';
      case 'hard': return 'bg-red-50 text-red-600';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <NavLink to="/admin" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </NavLink>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900">Manage Videos</span>
            <p className="text-xs text-slate-400">Upload and manage editorial videos</p>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          {problems.map((problem, index) => (
            <div key={problem._id} className={`flex items-center gap-4 p-4 card-professional animate-fade-in-up stagger-${Math.min(index+1, 5)}`}>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">{problem.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getDifficultyBadge(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                  <span className="text-xs text-slate-400">{problem.tags}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NavLink to={`/admin/upload/${problem._id}`} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </NavLink>
                <button onClick={() => handleDelete(problem._id)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminVideo;
