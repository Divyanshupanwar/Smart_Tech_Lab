import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import axiosClient from '../utils/axiosClient';
import { logoutUser } from '../authSlice';
import { Code, ArrowLeft, ClipboardList, Calendar, FileText, LogOut, Clock, CheckCircle2, ExternalLink } from 'lucide-react';

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

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const subjectColors = {
    DSA: 'bg-blue-50 text-blue-700',
    DAA: 'bg-violet-50 text-violet-700',
    OOPs: 'bg-emerald-50 text-emerald-700',
    CProgramming: 'bg-amber-50 text-amber-700',
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
              <span className="font-display text-lg font-bold text-stone-950">Assignments</span>
              <p className="text-xs text-stone-500">View your assignment PDFs and deadlines</p>
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
        <div className="mb-8 animate-fade-in-up">
          <div className="eyebrow-pill mb-4">Coursework hub</div>
          <h1 className="page-title text-4xl font-bold mb-2">Your Assignments</h1>
          <p className="page-subtitle">{assignments.length} assignments available</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-[3px] border-stone-300 border-t-[#2147ba] rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="surface-panel text-center py-20">
            <p className="text-stone-600">{error}</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="surface-panel text-center py-20 animate-fade-in">
            <ClipboardList className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500 text-lg">No assignments posted yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment, index) => (
              <div key={assignment._id} className={`card-professional p-6 ${index < 5 ? `animate-fade-in-up stagger-${index + 1}` : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-stone-950/5 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#2147ba]" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-stone-950">{assignment.title}</h3>
                      <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-bold ${subjectColors[assignment.subject] || 'bg-stone-50 text-stone-600'}`}>
                        {assignment.subject}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                      isOverdue(assignment.dueDate)
                        ? 'bg-red-50 text-red-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isOverdue(assignment.dueDate) ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {isOverdue(assignment.dueDate) ? 'Overdue' : 'Active'}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-stone-600 leading-relaxed mb-4 whitespace-pre-wrap">{assignment.description}</p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-stone-500 border-t border-stone-200/80 pt-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Due: {formatDate(assignment.dueDate)}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Total Marks: {assignment.totalMarks}</span>
                    {assignment.pdfUrl ? (
                      <a
                        href={assignment.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#2147ba] hover:text-[#173483] font-bold"
                      >
                        Open PDF <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </div>
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
