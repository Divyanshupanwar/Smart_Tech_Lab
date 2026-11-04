import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { ArrowLeft, CalendarClock, Check, ChevronDown, ClipboardList, Download, Eye, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import axiosClient from '../utils/axiosClient';

const subjects = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
const blankForm = () => ({ title: '', description: '', subject: 'DSA', semester: '', batch: '', targetStudents: '', targetGroups: '', startAt: '', endAt: '', durationMinutes: 60, maxAttempts: 1, gracePeriodSeconds: 0, autoSubmit: true });
const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const commaList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const pretty = (value) => value?.replaceAll('_', ' ') || '—';
const proctorDefaults = { tabVisibility: true, windowFocus: true, clipboard: true, contextMenu: true, fullscreen: true, camera: false, microphone: false, audioActivity: false, terminateOnRouteChange: true, maxViolations: 3, autoSubmitOnMaxViolations: true };
const blankQuestion = () => ({ title: '', description: '', constraints: '', marks: 10, visibleJson: '[{"input":"","output":"","explanation":""}]', hiddenJson: '[{"input":"","output":""}]', starterCode: [{ language: 'javascript', code: '' }, { language: 'java', code: '' }, { language: 'c++', code: '' }] });

function AdminLabExams() {
  const [exams, setExams] = useState([]);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(blankForm);
  const [proctoring, setProctoring] = useState(proctorDefaults);
  const [selected, setSelected] = useState({});
  const [customDraft, setCustomDraft] = useState(blankQuestion);
  const [customQuestions, setCustomQuestions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewTab, setViewTab] = useState('participants');
  const [participants, setParticipants] = useState([]);
  const [results, setResults] = useState([]);
  const [events, setEvents] = useState([]);
  const [monitoringSummary, setMonitoringSummary] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [monitorConnected, setMonitorConnected] = useState(false);

  const loadData = useCallback(async () => {
    const [examResponse, problemResponse] = await Promise.all([
      axiosClient.get('/lab-exams?limit=100'),
      axiosClient.get('/problem/getAllProblem?limit=200')
    ]);
    setExams(examResponse.data.exams || []);
    setProblems(problemResponse.data.problems || []);
  }, []);

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.response?.data?.message || 'Could not load exams or the question bank.'))
      .finally(() => setLoading(false));
  }, [loadData]);

  const filteredProblems = useMemo(() => problems.filter((problem) => problem.subject === form.subject), [problems, form.subject]);
  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const toggleProblem = (problem) => setSelected((current) => {
    const next = { ...current };
    if (next[problem._id]) delete next[problem._id];
    else next[problem._id] = { problemId: problem._id, marks: 10 };
    return next;
  });

  const addCustomQuestion = () => {
    try {
      const visibleTestCases = JSON.parse(customDraft.visibleJson);
      const hiddenTestCases = JSON.parse(customDraft.hiddenJson);
      if (!customDraft.title.trim() || !customDraft.description.trim()) throw new Error('Enter a title and problem description.');
      if (!Array.isArray(visibleTestCases) || !Array.isArray(hiddenTestCases)) throw new Error('Test case values must be JSON arrays.');
      setCustomQuestions((current) => [...current, {
        title: customDraft.title.trim(),
        description: customDraft.description.trim(),
        constraints: customDraft.constraints,
        marks: Number(customDraft.marks),
        visibleTestCases,
        hiddenTestCases,
        starterCode: customDraft.starterCode
      }]);
      setCustomDraft(blankQuestion());
      setError('');
    } catch (parseError) {
      setError(parseError.message || 'Check the test case JSON.');
    }
  };

  const resetForm = () => {
    setForm(blankForm());
    setSelected({});
    setCustomQuestions([]);
    setCustomDraft(blankQuestion());
    setProctoring(proctorDefaults);
    setEditingId(null);
  };

  const saveExam = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const questions = editingId ? undefined : [
        ...Object.values(selected).map((item) => ({ ...item, marks: Number(item.marks) })),
        ...customQuestions
      ];
      if (!editingId && !questions.length) throw new Error('Select a question or add a custom question.');
      const payload = {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        maxAttempts: Number(form.maxAttempts),
        gracePeriodSeconds: Number(form.gracePeriodSeconds),
        targetStudents: commaList(form.targetStudents),
        targetGroups: commaList(form.targetGroups),
        proctoring,
        questions
      };
      if (editingId) await axiosClient.put(`/lab-exams/${editingId}`, payload);
      else await axiosClient.post('/lab-exams', payload);
      setMessage(editingId ? 'Examination updated.' : 'Examination saved as a draft.');
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not save this examination.');
    } finally {
      setBusy(false);
    }
  };

  const editExam = (exam) => {
    setEditingId(exam._id);
    setForm({
      title: exam.title,
      description: exam.description,
      subject: exam.subject,
      semester: exam.semester || '',
      batch: exam.batch || '',
      targetStudents: (exam.targetStudents || []).join(', '),
      targetGroups: (exam.targetGroups || []).join(', '),
      startAt: localDateTime(exam.startAt),
      endAt: localDateTime(exam.endAt),
      durationMinutes: exam.durationMinutes,
      maxAttempts: exam.maxAttempts,
      gracePeriodSeconds: exam.gracePeriodSeconds || 0,
      autoSubmit: exam.autoSubmit
    });
    setProctoring({ ...proctorDefaults, ...exam.proctoring, clipboard: true, fullscreen: true });
    setSelected({});
    setCustomQuestions([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changePublish = async (exam) => {
    const route = exam.published ? 'unpublish' : 'publish';
    try {
      await axiosClient.post(`/lab-exams/${exam._id}/${route}`);
      setMessage(exam.published ? 'Examination unpublished.' : 'Examination published to eligible students.');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${route} this examination.`);
    }
  };

  const cancelExam = async (exam) => {
    if (!window.confirm(`Cancel “${exam.title}”? Students will lose access to active attempts.`)) return;
    try {
      await axiosClient.post(`/lab-exams/${exam._id}/cancel`);
      setMessage('Examination cancelled.');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not cancel examination.');
    }
  };

  const deleteExam = async (exam) => {
    if (!window.confirm(`Delete “${exam.title}”? This cannot be undone.`)) return;
    try {
      await axiosClient.delete(`/lab-exams/${exam._id}`);
      setMessage('Examination deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete examination.');
    }
  };

  const openMonitoring = async (exam) => {
    setViewing(exam);
    setViewTab('participants');
    setViewLoading(true);
    try {
      const [participantResponse, resultResponse, eventResponse] = await Promise.all([
        axiosClient.get(`/lab-exams/${exam._id}/participants`),
        axiosClient.get(`/lab-exams/${exam._id}/results`),
        axiosClient.get(`/lab-exams/${exam._id}/proctoring-events`)
      ]);
      setParticipants(participantResponse.data.participants || []);
      setMonitoringSummary(participantResponse.data.summary || null);
      setResults(resultResponse.data.results || []);
      setEvents(eventResponse.data.events || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load participants and results.');
    } finally {
      setViewLoading(false);
    }
  };

  const refreshMonitoring = useCallback(async () => {
    if (!viewing) return;
    try {
      const [participantResponse, resultResponse, eventResponse] = await Promise.all([
        axiosClient.get(`/lab-exams/${viewing._id}/participants`),
        axiosClient.get(`/lab-exams/${viewing._id}/results`),
        axiosClient.get(`/lab-exams/${viewing._id}/proctoring-events`)
      ]);
      setParticipants(participantResponse.data.participants || []);
      setMonitoringSummary(participantResponse.data.summary || null);
      setResults(resultResponse.data.results || []);
      setEvents(eventResponse.data.events || []);
    } catch { /* the last successful monitoring snapshot remains visible */ }
  }, [viewing]);
  const viewingId = viewing?._id;

  useEffect(() => {
    if (!viewing) return undefined;
    refreshMonitoring();
    const interval = window.setInterval(refreshMonitoring, 5000);
    return () => window.clearInterval(interval);
  }, [viewing, refreshMonitoring]);

  useEffect(() => {
    if (!viewingId) return undefined;
    const base = axiosClient.defaults.baseURL || window.location.origin;
    const origin = base.startsWith('http') ? base.replace(/\/api\/?$/, '') : window.location.origin;
    const socket = io(`${origin}/exams`, { withCredentials: true, reconnection: true, reconnectionAttempts: Infinity });
    socket.on('connect', () => {
      socket.emit('exam:monitor:join', { examId: viewingId }, (response) => {
        setMonitorConnected(Boolean(response?.ok));
        if (response?.ok) refreshMonitoring();
      });
    });
    socket.on('disconnect', () => setMonitorConnected(false));
    socket.on('connect_error', () => setMonitorConnected(false));
    socket.on('exam:activity', (event) => {
      if (event?.examId === viewingId) refreshMonitoring();
    });
    return () => { socket.disconnect(); setMonitorConnected(false); };
  }, [viewingId, refreshMonitoring]);

  const setCustomField = (name, value) => setCustomDraft((current) => ({ ...current, [name]: value }));
  const setStarter = (language, code) => setCustomDraft((current) => ({ ...current, starterCode: current.starterCode.map((item) => item.language === language ? { ...item, code } : item) }));

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-30 navbar-glass"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4"><NavLink to="/admin" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><ArrowLeft className="h-5 w-5" /></NavLink><div className="brand-mark grid h-10 w-10 place-items-center rounded-2xl"><ShieldCheck className="h-5 w-5 text-white" /></div><div><p className="font-bold text-stone-950">Lab Examinations</p><p className="text-xs text-stone-500">Create, schedule and review practicals</p></div></div></nav>
      <main className="mx-auto max-w-7xl space-y-10 px-5 py-9">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><span className="eyebrow-pill"><CalendarClock className="mr-1 h-3.5 w-3.5" /> Exam management</span><h1 className="page-title mt-4 text-4xl font-extrabold">Plan a practical</h1><p className="mt-2 text-sm text-stone-600">Choose questions from your question bank or create examination-specific questions.</p></div>{editingId && <button onClick={resetForm} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700">Cancel edit</button>}</div>
        {(error || message) && <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

        <form onSubmit={saveExam} className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="space-y-6">
          <section className="card-professional space-y-5 p-6">
              <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList className="h-5 w-5" /></div><div><h2 className="font-bold text-stone-900">Examination details</h2><p className="text-xs text-stone-500">Dates are interpreted in your local time zone.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-stone-700 sm:col-span-2">Title<input name="title" required maxLength={160} value={form.title} onChange={updateForm} placeholder="e.g., Data Structures Practical 1" className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-blue-400" /></label>
                <label className="text-sm font-medium text-stone-700 sm:col-span-2">Instructions<textarea name="description" required rows={4} value={form.description} onChange={updateForm} placeholder="Exam rules and instructions for students" className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-blue-400" /></label>
                <label className="text-sm font-medium text-stone-700">Subject<select name="subject" value={form.subject} onChange={(event) => { updateForm(event); setSelected({}); }} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
                <label className="text-sm font-medium text-stone-700">Semester<input name="semester" value={form.semester} onChange={updateForm} placeholder="e.g., 4" className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700">Batch<input name="batch" value={form.batch} onChange={updateForm} placeholder="e.g., 2024–2027" className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700">Duration (minutes)<input name="durationMinutes" type="number" min="1" max="600" value={form.durationMinutes} onChange={updateForm} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700">Start date and time<input name="startAt" type="datetime-local" required value={form.startAt} onChange={updateForm} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700">End date and time<input name="endAt" type="datetime-local" required value={form.endAt} onChange={updateForm} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700">Maximum attempts<input name="maxAttempts" type="number" min="1" max="10" value={form.maxAttempts} onChange={updateForm} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700">Grace period (seconds)<input name="gracePeriodSeconds" type="number" min="0" max="3600" value={form.gracePeriodSeconds} onChange={updateForm} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700 sm:col-span-2">Target student IDs <span className="font-normal text-stone-400">(comma separated; leave blank for all students matching other filters)</span><input name="targetStudents" value={form.targetStudents} onChange={updateForm} placeholder="MongoDB user IDs" className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="text-sm font-medium text-stone-700 sm:col-span-2">Target student groups <span className="font-normal text-stone-400">(comma separated)</span><input name="targetGroups" value={form.targetGroups} onChange={updateForm} placeholder="e.g., CSE-A, CSE-B" className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm" /></label>
                <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2"><input name="autoSubmit" type="checkbox" checked={form.autoSubmit} onChange={updateForm} className="accent-blue-700" />Automatically lock the attempt when its timer expires</label>
              </div>
            </section>

            {!editingId && <section className="card-professional p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold text-stone-900">Question bank</h2><p className="mt-1 text-xs text-stone-500">Questions are copied into this exam. Hidden tests and reference code are never sent to students.</p></div><span className="text-xs text-stone-500">{Object.keys(selected).length} selected</span></div>
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-stone-100 p-2">
                {filteredProblems.length ? filteredProblems.map((problem) => <label key={problem._id} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-stone-50"><input type="checkbox" checked={Boolean(selected[problem._id])} onChange={() => toggleProblem(problem)} className="accent-blue-700" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-stone-800">{problem.title}</span><span className="text-xs text-stone-500">{problem.difficulty} · {problem.tags}</span></span>{selected[problem._id] && <input aria-label={`Marks for ${problem.title}`} type="number" min="1" max="1000" value={selected[problem._id].marks} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected((current) => ({ ...current, [problem._id]: { ...current[problem._id], marks: event.target.value } }))} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-xs" />}</label>) : <p className="p-4 text-sm text-stone-500">No questions for this subject yet.</p>}
              </div>
              <div className="mt-6 border-t border-stone-100 pt-5">
                <div className="mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-blue-700" /><h3 className="font-semibold text-stone-900">Add custom question</h3></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={customDraft.title} onChange={(event) => setCustomField('title', event.target.value)} placeholder="Question title" className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm" />
                  <input type="number" min="1" max="1000" value={customDraft.marks} onChange={(event) => setCustomField('marks', event.target.value)} placeholder="Marks" className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm" />
                  <textarea value={customDraft.description} onChange={(event) => setCustomField('description', event.target.value)} placeholder="Problem statement" rows={4} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm sm:col-span-2" />
                  <textarea value={customDraft.constraints} onChange={(event) => setCustomField('constraints', event.target.value)} placeholder="Constraints (optional)" rows={2} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm sm:col-span-2" />
                  <label className="text-xs font-semibold text-stone-600">Visible test cases (JSON)<textarea value={customDraft.visibleJson} onChange={(event) => setCustomField('visibleJson', event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-xs" /></label>
                  <label className="text-xs font-semibold text-stone-600">Hidden test cases (JSON)<textarea value={customDraft.hiddenJson} onChange={(event) => setCustomField('hiddenJson', event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-xs" /></label>
                </div>
                <details className="mt-4"><summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-600"><ChevronDown className="h-3.5 w-3.5" />Starter code (optional)</summary><div className="mt-3 space-y-3">{customDraft.starterCode.map((entry) => <label key={entry.language} className="block text-xs text-stone-600">{entry.language}<textarea rows={3} value={entry.code} onChange={(event) => setStarter(entry.language, event.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-slate-900 p-3 font-mono text-xs text-white" /></label>)}</div></details>
                <button type="button" onClick={addCustomQuestion} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800"><Plus className="h-4 w-4" />Add question</button>
                {customQuestions.length > 0 && <div className="mt-4 space-y-2">{customQuestions.map((question, index) => <div key={`${question.title}-${index}`} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-sm"><span><strong>{question.title}</strong><span className="ml-2 text-xs text-stone-500">{question.marks} marks · {question.hiddenTestCases.length} hidden tests</span></span><button type="button" onClick={() => setCustomQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove custom question" className="text-red-500"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
              </div>
            </section>}
            {editingId && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">Editing examination details. Question changes are disabled after creation; questions stay attached to the saved draft.</div>}
          </div>

          <div className="space-y-6">
            <section className="card-professional p-6">
              <h2 className="font-bold text-stone-900">Proctoring checks</h2><p className="mt-1 text-xs leading-5 text-stone-500">Browser events are signals. No video or audio is uploaded.</p>
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Fullscreen is required. Copy, cut and paste are blocked; attempting them or leaving fullscreen ends the attempt immediately.</div>
              <div className="mt-4 space-y-3">{[
                ['tabVisibility', 'Tab changes'], ['windowFocus', 'Window loses focus'], ['contextMenu', 'Context menu'], ['camera', 'Camera permission'], ['facePresence', 'Face presence (when supported)'], ['microphone', 'Microphone permission'], ['audioActivity', 'Basic audio activity check']
              ].map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 text-sm text-stone-700"><span>{label}</span><input type="checkbox" checked={Boolean(proctoring[key])} onChange={(event) => setProctoring((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-blue-700" /></label>)}</div>
              <label className="mt-5 flex items-center justify-between gap-4 text-sm text-stone-700"><span>Terminate if the student navigates away from the exam route</span><input type="checkbox" checked={Boolean(proctoring.terminateOnRouteChange)} onChange={(event) => setProctoring((current) => ({ ...current, terminateOnRouteChange: event.target.checked }))} className="h-4 w-4 accent-blue-700" /></label>
              <label className="mt-5 block text-sm font-medium text-stone-700">Violation threshold (0 disables threshold termination)<input type="number" min="0" max="100" value={proctoring.maxViolations} onChange={(event) => setProctoring((current) => { const maxViolations = Number(event.target.value); return { ...current, maxViolations, autoSubmitOnMaxViolations: maxViolations >= 3 && current.autoSubmitOnMaxViolations }; })} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm" /></label>
              <label className="mt-4 flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={proctoring.autoSubmitOnMaxViolations} disabled={proctoring.maxViolations < 3} onChange={(event) => setProctoring((current) => ({ ...current, autoSubmitOnMaxViolations: event.target.checked }))} className="accent-blue-700 disabled:opacity-40" />Terminate the attempt when the configured threshold is reached</label>
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">The server records all events. Route changes can terminate immediately; the configurable violation threshold is at least 3. Browser events are evidence signals for instructor review, not proof by themselves.</p>
            </section>
            <section className="card-professional p-6"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-violet-600" /><div><h2 className="font-bold text-stone-900">Question summary</h2><p className="text-xs text-stone-500">Marks are assigned per question.</p></div></div><div className="mt-4 space-y-2 text-sm text-stone-600"><p>Question bank: {Object.keys(selected).length}</p><p>Custom: {customQuestions.length}</p><p>Selected marks: {[...Object.values(selected).map((item) => Number(item.marks)), ...customQuestions.map((item) => Number(item.marks))].reduce((sum, marks) => sum + marks, 0)}</p></div></section>
            <button disabled={busy} type="submit" className="btn-professional flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-50">{busy ? 'Saving…' : <><Check className="h-4 w-4" />{editingId ? 'Save changes' : 'Save as draft'}</>}</button>
          </div>
        </form>

        <section className="space-y-4">
          <div className="flex items-end justify-between"><div><span className="eyebrow-pill">Schedule</span><h2 className="mt-3 text-2xl font-bold text-stone-950">Your examinations</h2></div><span className="text-xs text-stone-500">{exams.length} total</span></div>
          {loading ? <div className="py-10 text-center text-stone-500">Loading…</div> : exams.length ? exams.map((exam) => <article key={exam._id} className="card-professional flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-[220px] flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-stone-900">{exam.title}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${exam.published ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{pretty(exam.status)}</span></div><p className="mt-1 text-xs text-stone-500">{exam.subject} · {exam.questionCount} questions · {exam.totalMarks} marks · {new Date(exam.startAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => openMonitoring(exam)} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700"><Eye className="h-3.5 w-3.5" />Participants & results</button><button onClick={() => editExam(exam)} disabled={exam.status === 'ACTIVE' || exam.status === 'COMPLETED' || exam.status === 'CANCELLED'} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 disabled:opacity-40">Edit</button><button onClick={() => changePublish(exam)} disabled={exam.status === 'ACTIVE' || exam.status === 'COMPLETED' || exam.status === 'CANCELLED'} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40">{exam.published ? 'Unpublish' : 'Publish'}</button><button onClick={() => deleteExam(exam)} disabled={exam.status === 'ACTIVE' || exam.status === 'COMPLETED'} aria-label="Delete exam" className="rounded-lg border border-red-100 p-2 text-red-500 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>{['SCHEDULED', 'ACTIVE'].includes(exam.status) && <button onClick={() => cancelExam(exam)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Cancel</button>}</div></article>) : <div className="card-professional p-8 text-center text-sm text-stone-500">No examinations have been created yet.</div>}
        </section>
      </main>

      {viewing && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 sm:p-8"><div className="mx-auto max-w-6xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Monitoring · {monitorConnected ? 'Live updates' : 'Reconnecting · 5-second refresh'}</p><h2 className="mt-1 text-xl font-bold text-stone-950">{viewing.title}</h2></div><div className="flex gap-2"><a href={`${axiosClient.defaults.baseURL}/lab-exams/${viewing._id}/results.csv`} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700"><Download className="h-4 w-4" />Export CSV</a><button onClick={() => setViewing(null)} className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold">Close</button></div></div>
          {monitoringSummary && <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{[['Enrolled', monitoringSummary.enrolledStudents], ['Joined', monitoringSummary.joinedAttempts], ['Active', monitoringSummary.active], ['Disconnected', monitoringSummary.disconnected], ['Submitted', monitoringSummary.submitted], ['Flagged', monitoringSummary.flagged]].map(([label, value]) => <div key={label} className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 text-lg font-bold text-stone-900">{value}</p></div>)}</div>}
          <div className="mt-5 flex gap-2 border-b border-stone-100 pb-3"><button onClick={() => setViewTab('participants')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${viewTab === 'participants' ? 'bg-blue-50 text-blue-800' : 'text-stone-500'}`}>Participants ({participants.length})</button><button onClick={() => setViewTab('results')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${viewTab === 'results' ? 'bg-blue-50 text-blue-800' : 'text-stone-500'}`}>Results ({results.length})</button><button onClick={() => setViewTab('violations')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${viewTab === 'violations' ? 'bg-blue-50 text-blue-800' : 'text-stone-500'}`}>Violations ({events.length})</button></div>
          {viewLoading ? <div className="py-12 text-center text-stone-500">Loading exam activity…</div> : viewTab === 'participants' ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-stone-400"><tr><th className="p-3">Student</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3">Score</th><th className="p-3">Violations</th><th className="p-3">Latest activity</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant.attemptId} className="border-t border-stone-100"><td className="p-3 font-medium">{participant.student?.firstName} {participant.student?.lastName}<span className="block text-xs text-stone-500">{participant.student?.emailID}</span></td><td className="p-3 text-xs">{new Date(participant.joinedAt).toLocaleString()}</td><td className="p-3">{pretty(participant.studentStatus || participant.status)}</td><td className="p-3">{participant.totalScore}</td><td className={`p-3 ${participant.flagged ? 'font-bold text-red-600' : ''}`}>{participant.violationCount}{participant.flagged ? ' · flagged' : ''}</td><td className="p-3 text-xs">{new Date(participant.latestActivity).toLocaleString()}</td></tr>)}</tbody></table>{!participants.length && <p className="p-6 text-sm text-stone-500">No students have joined yet.</p>}</div> : viewTab === 'results' ? <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto">{results.map((result) => <article key={result.attemptId} className="rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-stone-900">{result.student?.firstName} {result.student?.lastName}</p><p className="text-xs text-stone-500">{result.student?.emailID} · Attempt {result.attemptNumber} · {pretty(result.status)}</p></div><p className="font-mono text-sm font-semibold text-blue-800">{result.totalScore}/{result.totalMarks}</p></div>{result.submissions?.map((submission) => <details key={submission._id} className="mt-3 rounded-lg bg-stone-50 p-3"><summary className="cursor-pointer text-xs font-semibold text-stone-700">{submission.question?.title || 'Question'} · {submission.status} · {submission.score} marks · {submission.testCasesPassed}/{submission.testCasesTotal} hidden tests</summary>{submission.code && <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-white">{submission.code}</pre>}</details>)}</article>)}{!results.length && <p className="p-6 text-sm text-stone-500">No exam results have been recorded yet.</p>}</div> : <div className="mt-4 max-h-[65vh] overflow-y-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-stone-400"><tr><th className="p-3">Received</th><th className="p-3">Student</th><th className="p-3">Event</th><th className="p-3">Severity</th><th className="p-3">Details</th></tr></thead><tbody>{events.map((event) => <tr key={event._id} className="border-t border-stone-100"><td className="p-3 text-xs">{new Date(event.receivedAt).toLocaleString()}</td><td className="p-3">{event.studentId?.firstName} {event.studentId?.lastName}<span className="block text-xs text-stone-500">{event.studentId?.emailID}</span></td><td className="p-3">{pretty(event.eventType)}</td><td className={`p-3 font-semibold ${event.severity === 'flagged' ? 'text-red-600' : event.severity === 'strong_warning' ? 'text-amber-700' : 'text-stone-600'}`}>{pretty(event.severity)}</td><td className="max-w-xs truncate p-3 text-xs text-stone-500">{JSON.stringify(event.metadata || {})}</td></tr>)}</tbody></table>{!events.length && <p className="p-6 text-sm text-stone-500">No violations have been recorded.</p>}</div>}
        </div></div>}
    </div>
  );
}

export default AdminLabExams;
