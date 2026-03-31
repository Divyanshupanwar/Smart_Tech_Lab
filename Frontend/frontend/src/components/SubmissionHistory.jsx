import { useState, useEffect } from 'react';
import axiosClient from '../utils/axiosClient';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Eye, X } from 'lucide-react';

const SubmissionHistory = ({ problemId }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const extractSubmissions = (payload) => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.submissions)) {
      return payload.submissions;
    }

    return [];
  };

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const response = await axiosClient.get(`/problem/submittedProblem/${problemId}`);
        setSubmissions(extractSubmissions(response.data));
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch submission history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [problemId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'wrong': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted': return 'bg-emerald-50 text-emerald-600';
      case 'wrong': return 'bg-red-50 text-red-600';
      case 'error': return 'bg-amber-50 text-amber-600';
      case 'pending': return 'bg-blue-50 text-blue-600';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  const formatMemory = (memory) => {
    if (!memory) return 'N/A';
    if (memory < 1024) return `${memory} kB`;
    return `${(memory / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Submission History</h2>
      
      {submissions.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No submissions yet for this problem</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub, index) => (
            <div key={sub._id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
              <div className="flex-shrink-0">
                {getStatusIcon(sub.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getStatusBadge(sub.status)}`}>
                    {sub.status?.charAt(0).toUpperCase() + sub.status?.slice(1)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{sub.language}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{sub.runtime}s</span>
                  <span>{formatMemory(sub.memory)}</span>
                  <span>{sub.testCasesPassed}/{sub.testCasesTotal} passed</span>
                  <span>{formatDate(sub.createdAt)}</span>
                </div>
              </div>
              <button
                className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                onClick={() => setSelectedSubmission(sub)}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Code Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSubmission(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-900">Submission Code</h3>
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getStatusBadge(selectedSubmission.status)}`}>
                  {selectedSubmission.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">{selectedSubmission.language}</span>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              <pre className="p-6 bg-slate-900 text-slate-100 text-sm font-mono leading-relaxed">
                <code>{selectedSubmission.code}</code>
              </pre>
            </div>
            {selectedSubmission.errorMessage && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-red-600 text-sm">
                {selectedSubmission.errorMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionHistory;
