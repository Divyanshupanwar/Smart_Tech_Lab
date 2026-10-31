import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Clock3, Code2, GraduationCap, ShieldCheck, TriangleAlert } from 'lucide-react';
import axiosClient from '../utils/axiosClient';

const formatDate = (value) => new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium', timeStyle: 'short'
});

function ExamCard({ exam }) {
  const latest = exam.latestAttempt;
  const resultReady = latest && ['submitted', 'expired', 'terminated'].includes(latest.status);
  const canStart = exam.status === 'ACTIVE' && exam.attemptCount < exam.maxAttempts;
  const action = latest?.status === 'in_progress'
    ? { label: 'Resume examination', to: `/lab-practicals/${exam._id}/attempt/${latest._id}`, tone: 'bg-[#2147ba] text-white' }
    : canStart
      ? { label: exam.attemptCount ? 'Start next attempt' : 'Review instructions', to: `/lab-practicals/${exam._id}/instructions`, tone: 'bg-[#2147ba] text-white' }
      : resultReady
        ? { label: 'View my result', to: `/lab-practicals/${exam._id}/attempt/${latest._id}`, tone: 'bg-white text-stone-800 border border-stone-200' }
        : null;

  return (
    <article className="card-professional p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="eyebrow-pill">{exam.subject}{exam.semester ? ` · Semester ${exam.semester}` : ''}</span>
          <h3 className="mt-3 text-xl font-bold text-stone-950">{exam.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${exam.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : exam.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>
          {resultReady ? 'Attempt complete' : exam.status.toLowerCase()}
        </span>
      </div>
      <p className="text-sm leading-6 text-stone-600 line-clamp-3">{exam.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm text-stone-600">
        <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#2147ba]" />{formatDate(exam.startAt)}</div>
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#2147ba]" />{exam.durationMinutes} minutes</div>
        <div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-[#2147ba]" />{exam.questionCount} questions</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#2147ba]" />{exam.totalMarks} marks</div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <span className="text-xs text-stone-500">Attempts {exam.attemptCount}/{exam.maxAttempts}</span>
        {action ? <NavLink className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 ${action.tone}`} to={action.to}>{action.label}</NavLink> : (
          <span className="text-xs font-medium text-stone-500">{exam.status === 'SCHEDULED' ? 'Opens at the scheduled time' : 'No attempts remaining'}</span>
        )}
      </div>
    </article>
  );
}

function LabPracticals() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axiosClient.get('/lab-exams')
      .then(({ data }) => { if (active) setExams(data.exams || []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load lab practicals.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => ({
    upcoming: exams.filter((exam) => exam.status === 'SCHEDULED'),
    live: exams.filter((exam) => exam.status === 'ACTIVE' && (exam.attemptCount < exam.maxAttempts || exam.latestAttempt?.status === 'in_progress')),
    completed: exams.filter((exam) => exam.status === 'COMPLETED' || (['submitted', 'expired', 'terminated'].includes(exam.latestAttempt?.status) && exam.attemptCount >= exam.maxAttempts))
  }), [exams]);

  return (
    <div className="min-h-screen page-shell mesh-overlay">
      <nav className="sticky top-0 z-40 navbar-glass">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4">
          <NavLink to="/" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Back to dashboard"><ArrowLeft className="h-5 w-5" /></NavLink>
          <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-2xl"><GraduationCap className="h-5 w-5 text-white" /></div>
          <div><p className="font-display font-bold text-stone-950">Lab Practicals</p><p className="text-xs text-stone-500">University coding examinations</p></div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><span className="eyebrow-pill"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Practical examinations</span><h1 className="page-title mt-4 text-4xl font-extrabold">Your lab schedule</h1><p className="mt-2 text-stone-600">Review your upcoming sessions, join active exams and check your results.</p></div>
          <NavLink to="/" className="ghost-button inline-flex items-center gap-2 self-start px-4 py-2.5 text-sm font-semibold text-stone-700"><ArrowLeft className="h-4 w-4" /> Dashboard</NavLink>
        </div>
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm leading-6 text-blue-900"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>Exam checks record browser signals such as tab changes and focus. These are monitoring signals, not automatic proof of misconduct.</p></div>
        {loading ? <div className="py-20 text-center text-stone-500">Loading your examinations…</div> : error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div> : (
          <div className="space-y-10">
            {[
              ['Live now', groups.live], ['Upcoming', groups.upcoming], ['Completed', groups.completed]
            ].map(([title, items]) => (
              <section key={title}>
                <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-stone-900">{title}</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500 shadow-sm">{items.length}</span></div>
                {items.length ? <div className="grid gap-5 lg:grid-cols-2">{items.map((exam) => <ExamCard key={exam._id} exam={exam} />)}</div> : <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-sm text-stone-500">No {title.toLowerCase()} examinations right now.</div>}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default LabPracticals;
