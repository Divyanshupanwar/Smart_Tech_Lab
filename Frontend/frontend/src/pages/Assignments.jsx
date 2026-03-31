import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import axiosClient from '../utils/axiosClient';
import { logoutUser } from '../authSlice';
import { Code, ArrowLeft, ClipboardList, Calendar, FileText, LogOut, Clock, CheckCircle2 } from 'lucide-react';

function Assignments() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data } = await axiosClient.get('/assignment/all');
        setAssignments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching assignments:', err);
        setError('Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const handleLogout = () => dispatch(logoutUser());

  const isOverdue = (dueDate) => new Date(dueDate) < new Date();

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const subjectColors = {
    DSA: 'bg-blue-50 text-blue-600',
    DAA: 'bg-violet-50 text-violet-600',
    OOPs: 'bg-emerald-50 text-emerald-600',
    CProgramming: 'bg-amber-50 text-amber-600',
  };

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
              <span className="text-lg font-bold text-slate-900">Assignments</span>
              <p className="text-xs text-slate-400">View your assignments</p>
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
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Assignments</h1>
          <p className="text-slate-500">{assignments.length} assignments available</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-slate-500">{error}</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No assignments posted yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment, index) => (
              <div key={assignment._id} className={`card-professional p-6 animate-fade-in-up stagger-${Math.min(index+1, 5)}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{assignment.title}</h3>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-semibold ${subjectColors[assignment.subject] || 'bg-slate-50 text-slate-600'}`}>
                        {assignment.subject}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                      isOverdue(assignment.dueDate)
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {isOverdue(assignment.dueDate) ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {isOverdue(assignment.dueDate) ? 'Overdue' : 'Active'}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap">{assignment.description}</p>

                <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Due: {formatDate(assignment.dueDate)}
                  </div>
                  <span>Total Marks: {assignment.totalMarks}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Assignments;
