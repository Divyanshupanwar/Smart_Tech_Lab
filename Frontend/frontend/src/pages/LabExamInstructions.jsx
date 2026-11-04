import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Camera, Check, Clock3, Code2, Mic, ShieldAlert, ShieldCheck } from 'lucide-react';
import axiosClient from '../utils/axiosClient';

const formatDate = (value) => new Date(value).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });

function LabExamInstructions() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [mediaReady, setMediaReady] = useState(false);

  useEffect(() => {
    let active = true;
    axiosClient.get(`/lab-exams/${examId}`)
      .then(({ data }) => { if (active) setExam(data.exam); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load this examination.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId]);

  const checkMedia = async () => {
    const wantsVideo = exam?.proctoring?.camera || exam?.proctoring?.facePresence;
    const wantsAudio = exam?.proctoring?.microphone || exam?.proctoring?.audioActivity;
    if (!wantsVideo && !wantsAudio) { setMediaReady(true); return true; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support the camera or microphone permission required by this exam.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: Boolean(wantsVideo), audio: Boolean(wantsAudio) });
      stream.getTracks().forEach((track) => track.stop());
      setMediaReady(true);
      setError('');
      return true;
    } catch {
      setError('Camera or microphone permission was not granted. Allow the required device and try again.');
      return false;
    }
  };

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      const fullscreenRequest = document.fullscreenElement
        ? Promise.resolve()
        : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await fullscreenRequest;
      if (!document.fullscreenElement) throw new Error('Fullscreen was not enabled. Allow full-screen mode to begin this examination.');
      if (!(mediaReady || await checkMedia())) {
        await document.exitFullscreen().catch(() => {});
        return;
      }
      const { data } = await axiosClient.post(`/lab-exams/${examId}/join`);
      window.dispatchEvent(new CustomEvent('exam:attempt-started', { detail: { _id: data.attempt._id, examId } }));
      navigate(`/lab-practicals/${examId}/attempt/${data.attempt._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not join this examination.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="min-h-screen page-shell grid place-items-center text-stone-500">Loading examination instructions…</div>;
  if (!exam) return <main className="min-h-screen page-shell p-8"><p className="mx-auto max-w-3xl rounded-2xl bg-red-50 p-5 text-red-700">{error || 'Examination not found.'}</p></main>;

  const checks = [
    [true, 'Full-screen mode is required; leaving it ends the attempt'],
    [true, 'Copy, cut and paste are blocked; attempting them ends the attempt'],
    [exam.proctoring?.tabVisibility, 'Tab visibility changes are recorded'],
    [exam.proctoring?.windowFocus, 'Window focus changes are recorded'],
    [exam.proctoring?.contextMenu, 'Context menu attempts are recorded'],
    [exam.proctoring?.camera || exam.proctoring?.facePresence, 'Camera permission is required'],
    [exam.proctoring?.microphone, 'Microphone permission is required'],
    [exam.proctoring?.audioActivity, 'Basic audio activity is checked in your browser']
  ].filter(([enabled]) => enabled);

  return (
    <div className="min-h-screen page-shell mesh-overlay">
      <nav className="sticky top-0 z-40 navbar-glass"><div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4"><NavLink to="/lab-practicals" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><ArrowLeft className="h-5 w-5" /></NavLink><div className="brand-mark grid h-10 w-10 place-items-center rounded-2xl"><ShieldCheck className="h-5 w-5 text-white" /></div><div><p className="font-bold text-stone-950">Examination instructions</p><p className="text-xs text-stone-500">Please review before entering</p></div></div></nav>
      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-10 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="card-professional p-7 md:p-9">
          <span className="eyebrow-pill">{exam.subject}{exam.semester ? ` · Semester ${exam.semester}` : ''}</span>
          <h1 className="mt-4 text-3xl font-extrabold text-stone-950">{exam.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-600">{exam.description}</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Scheduled start</p><p className="mt-2 text-sm font-semibold text-stone-900">{formatDate(exam.startAt)}</p></div>
            <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Time allowed</p><p className="mt-2 text-sm font-semibold text-stone-900">{exam.durationMinutes} minutes · {exam.gracePeriodSeconds}s grace</p></div>
            <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Questions and marks</p><p className="mt-2 text-sm font-semibold text-stone-900">{exam.questionCount} questions · {exam.totalMarks} total marks</p></div>
            <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Attempts</p><p className="mt-2 text-sm font-semibold text-stone-900">Up to {exam.maxAttempts}</p></div>
          </div>
          <div className="mt-7 border-t border-stone-100 pt-6">
            <h2 className="flex items-center gap-2 font-bold text-stone-900"><Code2 className="h-4 w-4 text-[#2147ba]" /> Available languages</h2>
            <div className="mt-3 flex flex-wrap gap-2">{['JavaScript', 'Java', 'C++'].map((language) => <span key={language} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">{language}</span>)}</div>
          </div>
          <div className="mt-7 border-t border-stone-100 pt-6">
            <h2 className="flex items-center gap-2 font-bold text-stone-900"><ShieldAlert className="h-4 w-4 text-amber-600" /> Exam rules</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
              <li>Use the problem navigation to move between questions. Your code is saved automatically.</li>
              <li>Run checks only the visible examples. Submit evaluates your code against hidden tests.</li>
              <li>Browser monitoring records selected events. It does not prove misconduct and cannot detect every external device or shortcut.</li>
              <li>Navigating away from the examination route, leaving full screen, or attempting copy, cut or paste terminates this attempt immediately.</li>
              {exam.proctoring?.autoSubmitOnMaxViolations && exam.proctoring?.maxViolations >= 3 && <li>The server terminates the attempt at {exam.proctoring.maxViolations} recorded violations.</li>}
              {exam.autoSubmit && <li>Your attempt is submitted when its server-set timer expires.</li>}
            </ul>
          </div>
        </section>
        <aside className="space-y-5">
          <div className="card-professional p-6">
            <h2 className="text-lg font-bold text-stone-900">Permission check</h2>
            {checks.length ? <div className="mt-4 space-y-3">{checks.map(([, label]) => <p key={label} className="flex items-center gap-2 text-sm text-stone-600"><Check className="h-4 w-4 text-emerald-600" />{label}</p>)}</div> : <p className="mt-3 text-sm text-stone-600">No camera or microphone access is required.</p>}
            {exam.proctoring?.camera && <p className="mt-4 flex items-center gap-2 text-xs text-stone-500"><Camera className="h-4 w-4" />Camera processing stays in your browser.</p>}
            {exam.proctoring?.microphone && <p className="mt-2 flex items-center gap-2 text-xs text-stone-500"><Mic className="h-4 w-4" />No raw audio is uploaded or stored.</p>}
            {mediaReady && <p className="mt-4 text-xs font-semibold text-emerald-700">Device permission checked.</p>}
          </div>
          {error && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          <button type="button" onClick={join} disabled={joining || exam.status !== 'ACTIVE'} className="btn-professional flex w-full items-center justify-center gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-50">
            {joining ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Preparing your attempt…</> : <><Clock3 className="h-4 w-4" />{exam.status === 'ACTIVE' ? 'Enter fullscreen and join' : `Exam ${exam.status.toLowerCase()}`}</>}
          </button>
          {exam.proctoring?.camera || exam.proctoring?.microphone || exam.proctoring?.audioActivity ? <button type="button" onClick={checkMedia} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700">Check devices now</button> : null}
          <p className="text-center text-xs leading-5 text-stone-500">Server time determines your start and deadline. Refreshing the page will reconnect to the same active attempt.</p>
        </aside>
      </main>
    </div>
  );
}

export default LabExamInstructions;
