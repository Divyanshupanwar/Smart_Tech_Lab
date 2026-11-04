import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { NavLink, useParams } from 'react-router';
import { useSelector } from 'react-redux';
import { ArrowLeft, Camera, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Code2, Expand, Mic, Play, Save, Send, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import axiosClient from '../utils/axiosClient';

const languageLabels = { javascript: 'JavaScript', java: 'Java', 'c++': 'C++' };
const monacoLanguages = { javascript: 'javascript', java: 'java', 'c++': 'cpp' };
const draftKey = (attemptId) => `stl-exam-draft:${attemptId}`;
const savedDraftKey = (questionId, language) => `${questionId}:${language}`;
const remainingSeconds = (deadline, serverOffset) => Math.max(0, Math.floor((new Date(deadline).getTime() - (Date.now() + serverOffset)) / 1000));
const formatClock = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const starterFor = (question, language) => question?.starterCode?.find((item) => item.language === language)?.code || '';

function LabExamRoom() {
  const { attemptId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [drafts, setDrafts] = useState({});
  const [saveState, setSaveState] = useState('saved');
  const [runResult, setRunResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [connectionOnline, setConnectionOnline] = useState(navigator.onLine);
  const [mediaError, setMediaError] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const [violationMessage, setViolationMessage] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [showFinish, setShowFinish] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [consoleTab, setConsoleTab] = useState('run');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const editorRef = useRef(null);
  const autoFinishRef = useRef(false);
  const offlineSinceRef = useRef(null);
  const faceReportedAtRef = useRef(0);
  const audioReportedAtRef = useRef(0);
  const fullscreenRef = useRef(Boolean(document.fullscreenElement));
  const lastClipboardEventRef = useRef({ type: '', at: 0 });

  const currentQuestion = data?.questions?.find((question) => question._id === questionId) || data?.questions?.[0] || null;
  const currentKey = currentQuestion ? savedDraftKey(currentQuestion._id, language) : '';
  const currentCode = drafts[currentKey] ?? starterFor(currentQuestion, language);
  const isReadOnly = data?.attempt?.status !== 'in_progress';
  const canWork = !isReadOnly && fullscreen;
  const progress = data?.attempt?.questionProgress?.find((item) => item.questionId === currentQuestion?._id);
  const submissions = useMemo(() => data?.submissions || [], [data?.submissions]);

  const fetchAttempt = useCallback(async () => {
    const { data: response } = await axiosClient.get(`/lab-exams/attempts/${attemptId}`);
    const localDrafts = (() => {
      try { return JSON.parse(localStorage.getItem(draftKey(attemptId)) || '{}'); } catch { return {}; }
    })();
    const serverDrafts = Object.fromEntries((response.attempt.drafts || []).map((draft) => [savedDraftKey(draft.questionId, draft.language), draft.code]));
    const mergedDrafts = { ...serverDrafts, ...localDrafts };
    setData(response);
    setDrafts(mergedDrafts);
    setQuestionId((current) => current || response.questions[0]?._id || '');
    setViolationCount(response.attempt.violationCount || 0);
    setServerOffset(new Date(response.serverNow).getTime() - Date.now());
    setSecondsLeft(remainingSeconds(response.attempt.deadline, new Date(response.serverNow).getTime() - Date.now()));
    if (!response.attempt.drafts?.some((item) => item.language === 'javascript') && mergedDrafts[savedDraftKey(response.questions[0]?._id, 'javascript')] == null) {
      const initial = { ...mergedDrafts };
      for (const question of response.questions) {
        for (const item of question.starterCode || []) {
          const key = savedDraftKey(question._id, item.language);
          if (initial[key] == null) initial[key] = item.code;
        }
      }
      setDrafts(initial);
      try { localStorage.setItem(draftKey(attemptId), JSON.stringify(initial)); } catch { /* local persistence is best effort */ }
    }
  }, [attemptId]);

  useEffect(() => {
    let active = true;
    fetchAttempt().catch((error) => {
      if (active) setLoadError(error.response?.data?.message || 'Could not reconnect to your examination.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAttempt]);

  const reportEvent = useCallback(async (eventType, metadata = {}) => {
    try {
      const { data: response } = await axiosClient.post(`/lab-exams/attempts/${attemptId}/proctoring-events`, { eventType, metadata });
      setViolationCount(response.violationCount);
      setViolationMessage(`${response.severity || response.event?.severity || 'warning'} · ${response.violationCount} recorded event${response.violationCount === 1 ? '' : 's'}`);
      if (response.terminated || response.autoSubmitted) {
        setData((current) => current ? { ...current, attempt: {
          ...current.attempt,
          status: response.terminated ? 'terminated' : 'submitted',
          submittedAt: response.event.receivedAt,
          terminationReason: response.terminationReason || ''
        } } : current);
        setViolationMessage(response.terminated ? `Attempt terminated · ${response.terminationReason || 'proctoring policy'}` : 'Attempt automatically submitted at the violation threshold.');
        await fetchAttempt().catch(() => {});
      }
    } catch (error) {
      if (error.response?.status === 410) setSubmitError('The examination is no longer active.');
    }
  }, [attemptId, fetchAttempt]);

  const saveDraft = useCallback(async (qid, code, lang) => {
    if (!qid || typeof code !== 'string' || !lang || !canWork) return;
    setSaveState('saving');
    try {
      const { data: response } = await axiosClient.put(`/lab-exams/attempts/${attemptId}/drafts/${qid}`, { code, language: lang });
      setSaveState('saved');
      setData((current) => current ? {
        ...current,
        attempt: {
          ...current.attempt,
          drafts: [
            ...(current.attempt.drafts || []).filter((item) => !(item.questionId === qid && item.language === lang)),
            { questionId: qid, language: lang, code, updatedAt: response.savedAt }
          ]
        }
      } : current);
      return true;
    } catch (error) {
      setSaveState('offline');
      if (error.response?.status === 410) setSubmitError('The examination deadline has passed.');
      return false;
    }
  }, [attemptId, canWork]);

  useEffect(() => {
    if (!currentQuestion || !canWork) return undefined;
    const id = window.setTimeout(() => saveDraft(currentQuestion._id, currentCode, language), 750);
    return () => window.clearTimeout(id);
  }, [currentQuestion, currentCode, language, canWork, saveDraft]);

  useEffect(() => {
    if (!data?.attempt?.deadline || isReadOnly) return undefined;
    const tick = () => setSecondsLeft(remainingSeconds(data.attempt.deadline, serverOffset));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [data?.attempt?.deadline, serverOffset, isReadOnly]);

  useEffect(() => {
    if (isReadOnly) return undefined;
    let active = true;
    const beat = async () => {
      try {
        const { data: response } = await axiosClient.post(`/lab-exams/attempts/${attemptId}/heartbeat`);
        if (!active) return;
        setConnectionOnline(true);
        if (response.serverNow) setServerOffset(new Date(response.serverNow).getTime() - Date.now());
      } catch (error) {
        if (active) setConnectionOnline(false);
        if (error.response?.status === 410 && active) setSubmitError('Your examination attempt has ended.');
      }
    };
    beat();
    const interval = window.setInterval(beat, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [attemptId, isReadOnly]);

  const finishExam = useCallback(async (automatic = false) => {
    if (!data || !canWork || finishing) return;
    setFinishing(true);
    setSubmitError('');
    if (currentQuestion) await saveDraft(currentQuestion._id, currentCode, language);
    try {
      const { data: response } = await axiosClient.post(`/lab-exams/attempts/${attemptId}/finish`, { automatic });
      setData((current) => current ? { ...current, attempt: { ...current.attempt, status: response.status, submittedAt: response.submittedAt, totalScore: response.totalScore } } : current);
      setShowFinish(false);
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Could not submit your examination.');
    } finally {
      setFinishing(false);
    }
  }, [attemptId, currentCode, currentQuestion, data, finishing, canWork, language, saveDraft]);

  useEffect(() => {
    if (secondsLeft === 0 && data?.exam?.autoSubmit && canWork && !autoFinishRef.current) {
      autoFinishRef.current = true;
      finishExam(true);
    }
  }, [secondsLeft, data?.exam?.autoSubmit, canWork, finishExam]);

  useEffect(() => {
    const onOffline = () => {
      offlineSinceRef.current = Date.now();
      setConnectionOnline(false);
    };
    const onOnline = () => {
      const outageMs = offlineSinceRef.current ? Date.now() - offlineSinceRef.current : null;
      offlineSinceRef.current = null;
      setConnectionOnline(true);
      if (data?.exam?.proctoring) reportEvent('connection_interrupted', { outageMs });
      fetchAttempt().catch(() => {});
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [data?.exam?.proctoring, fetchAttempt, reportEvent]);

  useEffect(() => {
    const config = data?.exam?.proctoring;
    if (!config || isReadOnly) return undefined;
    const onVisibility = () => { if (document.hidden && config.tabVisibility) reportEvent('tab_hidden'); };
    const onBlur = () => { if (config.windowFocus) reportEvent('window_blur'); };
    const reportClipboardSignal = (type) => {
      const now = Date.now();
      if (lastClipboardEventRef.current.type === type && now - lastClipboardEventRef.current.at < 750) return;
      lastClipboardEventRef.current = { type, at: now };
      reportEvent(type);
    };
    const onClipboard = (type) => (event) => {
      event.preventDefault();
      event.stopPropagation();
      reportClipboardSignal(type);
    };
    const onCopy = onClipboard('copy');
    const onPaste = onClipboard('paste');
    const onCut = onClipboard('cut');
    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      let type = '';
      if ((event.ctrlKey || event.metaKey) && key === 'c') type = 'copy';
      else if ((event.ctrlKey || event.metaKey) && key === 'v') type = 'paste';
      else if ((event.ctrlKey || event.metaKey) && key === 'x') type = 'cut';
      else if (event.shiftKey && key === 'insert') type = 'paste';
      else if (event.shiftKey && key === 'delete') type = 'cut';
      else if (event.ctrlKey && key === 'insert') type = 'copy';
      if (type) {
        event.preventDefault();
        event.stopPropagation();
        reportClipboardSignal(type);
      }
    };
    const onContextMenu = (event) => {
      if (!config.contextMenu) return;
      event.preventDefault();
      reportEvent('context_menu');
    };
    const hasDraggedContent = (event) => Boolean(event.dataTransfer?.types?.length);
    const onDragOver = (event) => {
      if (!hasDraggedContent(event)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onDrop = (event) => {
      if (!hasDraggedContent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      reportEvent('paste', { source: 'drag_drop' });
    };
    const onFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      const wasFullscreen = fullscreenRef.current;
      fullscreenRef.current = active;
      setFullscreen(active);
      if (!active && wasFullscreen && config.fullscreen) reportEvent('fullscreen_exit');
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('cut', onCut, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    onFullscreen();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('cut', onCut, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
    };
  }, [data?.exam?.proctoring, isReadOnly, reportEvent]);

  useEffect(() => {
    const config = data?.exam?.proctoring;
    if (!config || (!config.camera && !config.microphone && !config.audioActivity && !config.facePresence) || isReadOnly) return undefined;
    let cancelled = false;
    let audioInterval;
    let faceInterval;
    const startMonitoring = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot access media devices.');
        const stream = await navigator.mediaDevices.getUserMedia({ video: Boolean(config.camera || config.facePresence), audio: Boolean(config.microphone || config.audioActivity) });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (config.camera || config.facePresence) {
          for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => reportEvent('camera_disconnected'));
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setSelfieUrl('ready');
          }
        }
        if (config.microphone || config.audioActivity) {
          for (const track of stream.getAudioTracks()) track.addEventListener('ended', () => reportEvent('microphone_disconnected'));
        }
        if (config.audioActivity && stream.getAudioTracks().length) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 512;
            const samples = new Float32Array(analyser.fftSize);
            audioInterval = window.setInterval(() => {
              analyser.getFloatTimeDomainData(samples);
              const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
              if (rms > 0.09 && Date.now() - audioReportedAtRef.current > 30000) {
                audioReportedAtRef.current = Date.now();
                reportEvent('audio_activity', { activityDetected: true });
              }
            }, 1000);
          }
        }
        if (config.facePresence && 'FaceDetector' in window && videoRef.current) {
          const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
          faceInterval = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const faces = await detector.detect(videoRef.current);
              if (Date.now() - faceReportedAtRef.current > 30000 && faces.length !== 1) {
                faceReportedAtRef.current = Date.now();
                reportEvent(faces.length === 0 ? 'face_missing' : 'multiple_faces', { detectedFaces: faces.length });
              }
            } catch { /* browser detector can fail without ending the attempt */ }
          }, 4000);
        } else if (config.facePresence) {
          setMediaError('Face presence detection is not supported by this browser; camera permission is still active.');
        }
      } catch (error) {
        setMediaError(error.message || 'Camera or microphone permission is unavailable.');
        if (config.camera || config.facePresence) reportEvent('camera_disconnected', { permissionUnavailable: true });
        else if (config.microphone || config.audioActivity) reportEvent('microphone_disconnected', { permissionUnavailable: true });
      }
    };
    startMonitoring();
    return () => {
      cancelled = true;
      window.clearInterval(audioInterval);
      window.clearInterval(faceInterval);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, [data?.exam?.proctoring, isReadOnly, reportEvent]);

  const changeQuestion = async (nextQuestion) => {
    if (currentQuestion && canWork) await saveDraft(currentQuestion._id, currentCode, language);
    setQuestionId(nextQuestion._id);
    setRunResult(null);
    setActiveTab('description');
  };

  const changeLanguage = async (nextLanguage) => {
    if (currentQuestion && canWork) await saveDraft(currentQuestion._id, currentCode, language);
    setLanguage(nextLanguage);
  };

  const handleCodeChange = (code = '') => {
    if (!canWork) return;
    const next = { ...drafts, [currentKey]: code };
    setDrafts(next);
    try { localStorage.setItem(draftKey(attemptId), JSON.stringify(next)); } catch { /* browser storage may be disabled */ }
    setSaveState('saving');
    setRunResult(null);
  };

  const runCode = async () => {
    if (!currentQuestion || !canWork) return;
    setConsoleTab('run');
    setActiveTab('tests');
    setRunResult({ loading: true });
    try {
      await saveDraft(currentQuestion._id, currentCode, language);
      const { data: result } = await axiosClient.post(`/lab-exams/attempts/${attemptId}/questions/${currentQuestion._id}/run`, { code: currentCode, language });
      setRunResult(result);
    } catch (error) {
      setRunResult({ error: error.response?.data?.message || 'Code execution failed.' });
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !canWork) return;
    setSubmitting(true);
    setSubmitError('');
    setConsoleTab('submission');
    try {
      await saveDraft(currentQuestion._id, currentCode, language);
      const { data: result } = await axiosClient.post(`/lab-exams/attempts/${attemptId}/questions/${currentQuestion._id}/submit`, {
        code: currentCode,
        language,
        clientSubmissionId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
      });
      setData((current) => current ? {
        ...current,
        submissions: [{ ...result.submission, questionId: currentQuestion._id, createdAt: new Date().toISOString() }, ...(current.submissions || [])],
        attempt: {
          ...current.attempt,
          totalScore: Math.max(current.attempt.totalScore || 0, progress?.bestScore || 0) + Math.max(0, (result.submission.score || 0) - (progress?.bestScore || 0)),
          questionProgress: (current.attempt.questionProgress || []).map((item) => item.questionId === currentQuestion._id
            ? { ...item, bestScore: Math.max(item.bestScore || 0, result.submission.score || 0), latestStatus: result.submission.status }
            : item)
        }
      } : current);
      setRunResult({ submission: result.submission });
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const restoreFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { setSubmitError('Fullscreen could not be enabled by this browser.'); }
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#090e19] text-slate-300">Reconnecting to your examination…</div>;
  if (!data) return <main className="min-h-screen bg-[#090e19] p-8 text-slate-200"><div className="mx-auto max-w-2xl rounded-2xl border border-red-400/20 bg-red-400/10 p-6"><p>{loadError}</p><button onClick={() => { setLoading(true); setLoadError(''); fetchAttempt().catch((error) => setLoadError(error.response?.data?.message || 'Could not reconnect.')).finally(() => setLoading(false)); }} className="mt-4 rounded-xl bg-white/10 px-4 py-2">Reconnect</button></div></main>;

  const questionIndex = data.questions.findIndex((question) => question._id === currentQuestion?._id);
  const formattedScore = `${data.attempt.totalScore || 0} / ${data.exam.totalMarks}`;

  return (
    <div className="min-h-screen bg-[#090e19] text-slate-100">
      {!fullscreen && !isReadOnly && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#090e19] p-6 text-center"><div className="max-w-md rounded-3xl border border-amber-300/20 bg-[#121c2c] p-8 shadow-2xl"><Expand className="mx-auto h-9 w-9 text-amber-300" /><h2 className="mt-4 text-2xl font-bold">Full-screen mode is required</h2><p className="mt-3 text-sm leading-6 text-slate-300">Your editor is locked until you return to full screen. Leaving full screen is recorded and terminates the attempt.</p><button type="button" onClick={restoreFullscreen} className="mt-6 rounded-xl bg-[#2147ba] px-5 py-3 text-sm font-semibold text-white">Resume full screen</button></div></div>}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1422]/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <NavLink to="/lab-practicals" className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Back to lab practicals"><ArrowLeft className="h-4 w-4" /></NavLink>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{data.exam.title}</p><p className="text-xs text-slate-400">{data.exam.subject} · Attempt {data.attempt.attemptNumber}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${connectionOnline ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{connectionOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{connectionOnline ? 'Connected' : 'Offline'}</span>
            {user?.firstName && <span className="hidden text-xs text-slate-400 sm:inline">{user.firstName}</span>}
            <span className="hidden text-xs text-slate-400 sm:inline">Draft {saveState}</span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 font-mono text-sm"><Clock3 className="h-4 w-4 text-amber-300" />{secondsLeft == null ? '--:--:--' : formatClock(secondsLeft)}</span>
            <span className="hidden rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300 md:inline">Score {formattedScore}</span>
            <span className="hidden text-xs text-slate-400 md:inline">{data.attempt.status.replaceAll('_', ' ')}</span>
            {!isReadOnly && <button type="button" onClick={() => setShowFinish(true)} disabled={!canWork} className="rounded-xl bg-[#2147ba] px-3 py-2 text-xs font-semibold hover:bg-blue-600 disabled:opacity-40">Submit exam</button>}
          </div>
        </div>
        {violationMessage && <div className="border-t border-white/5 px-5 py-1.5 text-xs text-amber-200">Monitoring signal #{violationCount}: {violationMessage}</div>}
      </header>

      {mediaError && <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs text-amber-100"><CircleAlert className="h-4 w-4 shrink-0" />{mediaError}</div>}
      {submitError && <div role="alert" className="flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-100"><span>{submitError}</span><button onClick={() => setSubmitError('')} aria-label="Dismiss" className="text-lg">×</button></div>}

      <main className="grid min-h-[calc(100vh-62px)] lg:grid-cols-[minmax(320px,0.9fr)_minmax(460px,1.1fr)]">
        <section className="flex min-h-[45vh] flex-col border-b border-white/10 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
            {data.questions.map((question, index) => <button key={question._id} disabled={!canWork} onClick={() => changeQuestion(question)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${question._id === currentQuestion?._id ? 'bg-[#2147ba] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>Q{index + 1}<span className="ml-1.5 opacity-70">{question.marks}m</span></button>)}
          </div>
          <div className="flex gap-4 border-b border-white/10 px-4 py-3 text-xs">
            <button onClick={() => setActiveTab('description')} className={activeTab === 'description' ? 'font-semibold text-white' : 'text-slate-400'}>Problem</button>
            <button onClick={() => setActiveTab('tests')} className={activeTab === 'tests' ? 'font-semibold text-white' : 'text-slate-400'}>Visible tests</button>
            <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'font-semibold text-white' : 'text-slate-400'}>Submissions ({submissions.length})</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
            {activeTab === 'description' && currentQuestion && <div className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Question {questionIndex + 1}</p><h1 className="mt-2 text-2xl font-bold">{currentQuestion.title}</h1></div><span className="shrink-0 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200">{currentQuestion.marks} marks</span></div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{currentQuestion.description}</div>
              {currentQuestion.constraints && <div className="mt-7"><h2 className="mb-2 text-sm font-semibold text-slate-200">Constraints</h2><pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-300">{currentQuestion.constraints}</pre></div>}
              {currentQuestion.examples?.map((example, index) => <div key={`${index}-${example.input}`} className="mt-7"><h2 className="mb-2 text-sm font-semibold text-slate-200">Example {index + 1}</h2><div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-xs"><div className="grid gap-0 sm:grid-cols-2"><div className="p-4"><p className="mb-2 text-slate-500">Input</p><pre className="whitespace-pre-wrap text-slate-200">{example.input}</pre></div><div className="border-t border-white/10 p-4 sm:border-l sm:border-t-0"><p className="mb-2 text-slate-500">Output</p><pre className="whitespace-pre-wrap text-slate-200">{example.output}</pre></div></div>{example.explanation && <p className="border-t border-white/10 p-4 leading-5 text-slate-400">{example.explanation}</p>}</div></div>)}
              <div className="mt-8 flex justify-between border-t border-white/10 pt-4"><button disabled={questionIndex <= 0} onClick={() => changeQuestion(data.questions[questionIndex - 1])} className="inline-flex items-center gap-1 text-xs text-slate-400 disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Previous</button><button disabled={questionIndex >= data.questions.length - 1} onClick={() => changeQuestion(data.questions[questionIndex + 1])} className="inline-flex items-center gap-1 text-xs text-slate-400 disabled:opacity-30">Next<ChevronRight className="h-4 w-4" /></button></div>
            </div>}
            {activeTab === 'tests' && <div className="space-y-4">
              {currentQuestion?.visibleTestCases?.length ? currentQuestion.visibleTestCases.map((testCase, index) => <article key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="mb-3 text-xs font-semibold text-slate-300">Visible test {index + 1}</p><div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-1 text-[11px] text-slate-500">Input</p><pre className="whitespace-pre-wrap text-xs text-slate-300">{testCase.input}</pre></div><div><p className="mb-1 text-[11px] text-slate-500">Expected output</p><pre className="whitespace-pre-wrap text-xs text-slate-300">{testCase.output}</pre></div></div></article>) : <p className="text-sm text-slate-400">This question has no visible test cases.</p>}
            </div>}
            {activeTab === 'history' && <div className="space-y-3">{submissions.length ? submissions.filter((item) => !item.questionId || item.questionId === currentQuestion?._id).map((submission) => <article key={submission._id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div><p className="text-sm font-semibold">{submission.status}</p><p className="mt-1 text-xs text-slate-400">{submission.testCasesPassed}/{submission.testCasesTotal} hidden tests · {new Date(submission.createdAt).toLocaleString()}</p></div><span className="font-mono text-sm text-blue-200">{submission.score ?? 0} marks</span></article>) : <p className="text-sm text-slate-400">Your submissions will appear here.</p>}</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">{(data.exam.proctoring?.camera || data.exam.proctoring?.facePresence) && <span className="inline-flex items-center gap-1"><Camera className={`h-3.5 w-3.5 ${selfieUrl ? 'text-emerald-300' : 'text-slate-500'}`} />Camera</span>}{(data.exam.proctoring?.microphone || data.exam.proctoring?.audioActivity) && <span className="inline-flex items-center gap-1"><Mic className="h-3.5 w-3.5 text-emerald-300" />Mic</span>}<span className="inline-flex items-center gap-1"><Save className="h-3.5 w-3.5" />{saveState}</span></div>
            {saveState === 'offline' && <button onClick={() => currentQuestion && saveDraft(currentQuestion._id, currentCode, language)} className="text-blue-300">Retry save</button>}
          </div>
          <video ref={videoRef} muted playsInline className="hidden" aria-label="Local camera preview" />
        </section>

        <section className="flex min-h-[65vh] flex-col lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-2 text-xs font-medium text-slate-300">{languageLabels[language]} · Question {questionIndex + 1}</span></div>
            <select value={language} onChange={(event) => changeLanguage(event.target.value)} disabled={!canWork} className="rounded-lg border border-white/10 bg-[#131d2d] px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-400">{Object.entries(languageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          </div>
          <div className="min-h-[320px] flex-1">
            <Editor height="100%" language={monacoLanguages[language]} value={currentCode} onChange={(value) => handleCodeChange(value || '')} onMount={(editor) => { editorRef.current = editor; }} theme="vs-dark" options={{ readOnly: !canWork, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, insertSpaces: true, wordWrap: 'on', padding: { top: 16, bottom: 16 }, quickSuggestions: false, suggestOnTriggerCharacters: false }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 bg-[#0d1422] px-4 py-3">
            <div className="flex gap-2"><button type="button" onClick={runCode} disabled={!canWork || !connectionOnline} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-40"><Play className="h-3.5 w-3.5" />Run visible tests</button><button type="button" onClick={submitAnswer} disabled={!canWork || submitting || !connectionOnline} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">{submitting ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-3.5 w-3.5" />}Submit answer</button></div>
            <span className="text-xs text-slate-500">Best score: {progress?.bestScore || 0} / {currentQuestion?.marks || 0}</span>
          </div>
          <div className="min-h-[160px] flex-1 overflow-y-auto bg-[#0b111d] p-4">
            <div className="mb-3 flex gap-4 text-xs"><button onClick={() => setConsoleTab('run')} className={consoleTab === 'run' ? 'font-semibold text-white' : 'text-slate-500'}>Execution</button><button onClick={() => setConsoleTab('submission')} className={consoleTab === 'submission' ? 'font-semibold text-white' : 'text-slate-500'}>Latest submission</button></div>
            {consoleTab === 'run' && (!runResult ? <p className="text-xs text-slate-500">Run code to see output for visible test cases.</p> : runResult.loading ? <p className="text-xs text-slate-400">Running on Judge0…</p> : runResult.error ? <p className="text-xs text-red-300">{runResult.error}</p> : <div className="space-y-2">{runResult.testCases?.map((item, index) => <div key={index} className="flex flex-wrap items-center gap-2 text-xs"><CheckCircle2 className={`h-3.5 w-3.5 ${item.passed ? 'text-emerald-400' : 'text-red-400'}`} /><span className={item.passed ? 'text-emerald-200' : 'text-red-200'}>Test {index + 1}: {item.status}</span>{item.actualOutput && <code className="ml-auto max-w-full truncate text-slate-400">Output: {item.actualOutput}</code>}</div>)}{runResult.testCases && <p className="pt-2 text-xs text-slate-400">{runResult.testCasesPassed}/{runResult.testCasesTotal} visible tests passed.</p>}</div>)}
            {consoleTab === 'submission' && (runResult?.submission ? <div className="flex items-start justify-between gap-3"><div><p className={`text-sm font-semibold ${runResult.submission.status === 'accepted' ? 'text-emerald-300' : 'text-amber-200'}`}>{runResult.submission.status}</p><p className="mt-1 text-xs text-slate-400">{runResult.submission.testCasesPassed}/{runResult.submission.testCasesTotal} hidden tests · {runResult.submission.errorMessage}</p></div><span className="font-mono text-sm text-blue-200">{runResult.submission.score}/{runResult.submission.maxScore}</span></div> : <p className="text-xs text-slate-500">Submit an answer to see its verified result.</p>)}
          </div>
          {isReadOnly && <div className={`border-t px-5 py-3 text-sm ${data.attempt.status === 'terminated' ? 'border-red-500/20 bg-red-500/10 text-red-100' : 'border-emerald-500/10 bg-emerald-500/10 text-emerald-100'}`}>Attempt {data.attempt.status.replaceAll('_', ' ')}{data.attempt.terminationReason ? ` · ${data.attempt.terminationReason.replaceAll('_', ' ')}` : ''}. Final score: {data.attempt.totalScore}/{data.exam.totalMarks}</div>}
        </section>
      </main>

      {showFinish && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121c2c] p-6 shadow-2xl"><h2 className="text-lg font-bold">Submit examination?</h2><p className="mt-2 text-sm leading-6 text-slate-400">Your saved answers will be retained. You cannot make changes after submitting.</p><p className="mt-4 text-xs text-slate-500">Current score: {formattedScore}</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowFinish(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Continue working</button><button onClick={() => finishExam(false)} disabled={finishing} className="rounded-xl bg-[#2147ba] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{finishing ? 'Submitting…' : 'Submit now'}</button></div></div></div>}
    </div>
  );
}

export default LabExamRoom;
