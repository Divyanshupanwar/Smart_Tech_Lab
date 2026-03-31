import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router';
import axiosClient from '../utils/axiosClient';
import { ArrowLeft, Code, Send, ClipboardList } from 'lucide-react';

function AdminAssignment() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: 'DSA',
    dueDate: '',
    totalMarks: 100,
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!form.title || !form.description || !form.dueDate) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      const { data } = await axiosClient.post('/assignment/create', {
        ...form,
        totalMarks: Number(form.totalMarks),
      });

      setMessage({ type: 'success', text: data.message || 'Assignment created successfully!' });
      setForm({ title: '', description: '', subject: 'DSA', dueDate: '', totalMarks: 100 });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data || 'Failed to create assignment' });
    } finally {
      setLoading(false);
    }
  };

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
            <span className="text-lg font-bold text-slate-900">Create Assignment</span>
            <p className="text-xs text-slate-400">Create a new assignment for students</p>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="card-professional p-8 animate-scale-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">New Assignment</h2>
              <p className="text-xs text-slate-400">Fill in the assignment details</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Title *</label>
              <input
                type="text" name="title" value={form.title} onChange={handleChange} required
                placeholder="e.g., DSA Assignment 1 - Arrays and Linked Lists"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
              <textarea
                name="description" value={form.description} onChange={handleChange} required rows={5}
                placeholder="Describe the assignment requirements..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject *</label>
                <select name="subject" value={form.subject} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400">
                  <option value="DSA">DSA</option>
                  <option value="DAA">DAA</option>
                  <option value="OOPs">OOPs</option>
                  <option value="CProgramming">C Programming</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Due Date *</label>
                <input type="datetime-local" name="dueDate" value={form.dueDate} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Total Marks</label>
                <input type="number" name="totalMarks" value={form.totalMarks} onChange={handleChange} min="1" max="1000" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-xl border text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                {message.text}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full btn-professional flex items-center justify-center gap-2 py-3.5 disabled:opacity-50">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Send className="w-4 h-4" /> Create Assignment</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminAssignment;
