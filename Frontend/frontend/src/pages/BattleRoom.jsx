import { useCallback, useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { NavLink, useParams } from 'react-router';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Expand, Play, Send, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import axiosClient from '../utils/axiosClient';

const labels = { javascript: 'JavaScript', java: 'Java', 'c++': 'C++' };
const editorLanguages = { javascript: 'javascript', java: 'java', 'c++': 'cpp' };
const draftStorageKey = (battleId) => `stl-battle-drafts:${battleId}`;
const draftId = (questionId, language) => `${questionId}:${language}`;
const socketOrigin = () => {
  const base = axiosClient.defaults.baseURL || window.location.origin;
  return base.startsWith('http') ? base.replace(/\/api\/?$/, '') : window.location.origin;
};
const starterFor = (question, language) => question?.starterCode?.find((item) => item.language === language)?.code || '';
const secondsUntil = (date, offset) => Math.max(0, Math.floor((new Date(date).getTime() - (Date.now() + offset)) / 1000));
const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function BattleRoom() {
  const { battleId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [questionId, setQuestionId] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [drafts, setDrafts] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved');
  const [runResult, setRunResult] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('problem');
  const [consoleTab, setConsoleTab] = useState('run');
  const [showCancel, setShowCancel] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [connectionMap, setConnectionMap] = useState({});
  const [presenceEvent, setPresenceEvent] = useState('');

  const me = battle?.players?.find((player) => player.isYou);
  const opponent = battle?.players?.find((player) => !player.isYou);
  const currentQuestion = battle?.questions?.find((question) => question._id === questionId) || battle?.questions?.[0] || null;
  const currentDraftKey = currentQuestion ? draftId(currentQuestion._id, language) : '';
  const currentCode = drafts[currentDraftKey] ?? starterFor(currentQuestion, language);
  const live = battle?.status === 'ACTIVE';
  const finished = ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(battle?.status);
  const battleStatus = battle?.status;
  const battleStartsAt = battle?.startsAt;
  const battleEndsAt = battle?.endsAt;
  const canEdit = live && secondsLeft !== 0;
  const questionIndex = battle?.questions?.findIndex((question) => question._id === currentQuestion?._id) ?? -1;
  const scoreRows = useMemo(() => battle?.players || [], [battle?.players]);

  const loadBattle = useCallback(async () => {
    const { data } = await axiosClient.get(`/battle/${battleId}`);
    setBattle(data.battle);
    setServerOffset(new Date(data.serverNow).getTime() - Date.now());
    setSecondsLeft(data.battle.status === 'ACTIVE' ? secondsUntil(data.battle.endsAt, new Date(data.serverNow).getTime() - Date.now()) : secondsUntil(data.battle.startsAt, new Date(data.serverNow).getTime() - Date.now()));
    setQuestionId((current) => current || data.battle.questions[0]?._id || '');
    const local = (() => { try { return JSON.parse(localStorage.getItem(draftStorageKey(battleId)) || '{}'); } catch { return {}; } })();
    const server = Object.fromEntries((data.battle.drafts || []).map((draft) => [draftId(draft.questionId, draft.language), draft.code]));
    setDrafts((current) => ({ ...server, ...local, ...current }));
  }, [battleId]);

  useEffect(() => {
    let active = true;
    loadBattle().catch((requestError) => { if (active) setLoadError(requestError.response?.data?.message || 'Could not load this battle.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadBattle]);

  useEffect(() => {
    const socket = io(`${socketOrigin()}/battle`, { withCredentials: true, reconnection: true, reconnectionAttempts: Infinity });
    socket.on('connect', async () => {
      setSocketConnected(true);
      try {
        await axiosClient.post(`/battle/${battleId}/join`);
        socket.emit('battle:join', { battleId }, (response) => {
          if (!response?.ok) setError(response?.message || 'Could not join live battle updates.');
        });
        await loadBattle();
      } catch (requestError) { setError(requestError.response?.data?.message || 'Battle reconnection failed.'); }
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('battle:started', (event) => { setBattle((current) => current ? { ...current, status: 'ACTIVE', startsAt: event.startsAt, endsAt: event.endsAt } : current); loadBattle().catch(() => {}); });
    socket.on('battle:score', (event) => {
      setBattle((current) => current ? {
        ...current,
        players: current.players.map((player) => {
          const update = event.players.find((item) => item.userId === player.user?._id);
          return update ? { ...player, score: update.score, acceptedCount: update.acceptedCount } : player;
        })
      } : current);
      if (event.latestSubmission?.userId !== user?._id) setPresenceEvent(`${opponent?.user?.firstName || 'Opponent'} submitted a solution.`);
    });
    socket.on('battle:presence', (event) => {
      setConnectionMap((current) => ({ ...current, [event.userId]: event.status }));
      if (event.userId !== user?._id) setPresenceEvent(`${opponent?.user?.firstName || 'Opponent'} ${event.status === 'connected' ? 'reconnected' : 'disconnected'}.`);
    });
    socket.on('battle:completed', () => { loadBattle().catch(() => {}); });
    return () => socket.disconnect();
  }, [battleId, loadBattle, opponent?.user?.firstName, user?._id]);

  useEffect(() => {
    if (!battleStatus || finished) return undefined;
    const tick = () => {
      const target = battleStatus === 'ACTIVE' ? battleEndsAt : battleStartsAt;
      setSecondsLeft(secondsUntil(target, serverOffset));
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [battleStatus, battleStartsAt, battleEndsAt, finished, serverOffset]);

  const saveDraft = useCallback(async (question, code, lang) => {
    if (!question || !canEdit) return false;
    setSaveStatus('saving');
    try {
      const { data } = await axiosClient.put(`/battle/${battleId}/drafts/${question._id}`, { code, language: lang });
      setBattle((current) => current ? {
        ...current,
        drafts: [
          ...(current.drafts || []).filter((draft) => !(draft.questionId === question._id && draft.language === lang)),
          { questionId: question._id, language: lang, code, updatedAt: data.savedAt }
        ]
      } : current);
      setSaveStatus('saved');
      return true;
    } catch (requestError) {
      setSaveStatus('offline');
      if (requestError.response?.status === 410) setError('The battle has ended.');
      return false;
    }
  }, [battleId, canEdit]);

  useEffect(() => {
    if (!currentQuestion || !canEdit) return undefined;
    const timer = window.setTimeout(() => saveDraft(currentQuestion, currentCode, language), 700);
    return () => window.clearTimeout(timer);
  }, [currentQuestion, currentCode, language, canEdit, saveDraft]);

  const changeCode = (code = '') => {
    const next = { ...drafts, [currentDraftKey]: code };
    setDrafts(next);
    try { localStorage.setItem(draftStorageKey(battleId), JSON.stringify(next)); } catch { /* local recovery is best effort */ }
    setSaveStatus('saving'); setRunResult(null);
  };

  const changeQuestion = async (question) => {
    if (currentQuestion && canEdit) await saveDraft(currentQuestion, currentCode, language);
    setQuestionId(question._id); setRunResult(null);
  };
  const changeLanguage = async (nextLanguage) => {
    if (currentQuestion && canEdit) await saveDraft(currentQuestion, currentCode, language);
    setLanguage(nextLanguage);
  };

  const runCode = async () => {
    if (!currentQuestion || !canEdit) return;
    setRunResult({ loading: true }); setActiveTab('tests'); setConsoleTab('run');
    try {
      await saveDraft(currentQuestion, currentCode, language);
      const { data } = await axiosClient.post(`/battle/${battleId}/questions/${currentQuestion._id}/run`, { code: currentCode, language });
      setRunResult(data);
    } catch (requestError) { setRunResult({ error: requestError.response?.data?.message || 'Code execution failed.' }); }
  };

  const submitCode = async () => {
    if (!currentQuestion || !canEdit || busy) return;
    setBusy(true); setError(''); setConsoleTab('submission');
    try {
      await saveDraft(currentQuestion, currentCode, language);
      const { data } = await axiosClient.post(`/battle/${battleId}/questions/${currentQuestion._id}/submit`, {
        code: currentCode,
        language,
        clientSubmissionId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
      });
      setSubmission(data.submission);
      setBattle((current) => current ? {
        ...current,
        players: current.players.map((player) => player.isYou ? { ...player, score: data.submission.score, acceptedCount: data.submission.acceptedCount } : player)
      } : current);
      if (data.submission.battleStatus === 'COMPLETED') await loadBattle();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Submission could not be evaluated.'); }
    finally { setBusy(false); }
  };

  const cancelBeforeStart = async () => {
    try { await axiosClient.post(`/battle/${battleId}/cancel`); await loadBattle(); setShowCancel(false); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not cancel battle.'); }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setError('Fullscreen is unavailable in this browser.'); }
  };

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#090e19] text-slate-300">Loading battle room…</div>;
  if (!battle) return <main className="min-h-screen bg-[#090e19] p-8 text-slate-200"><div className="mx-auto max-w-2xl rounded-2xl border border-red-400/20 bg-red-400/10 p-6"><p>{loadError}</p><NavLink to="/battle-arena" className="mt-4 inline-block rounded-xl bg-white/10 px-4 py-2">Back to Battle Arena</NavLink></div></main>;

  const opponentConnected = connectionMap[opponent?.user?._id] || opponent?.connectionStatus || 'connected';
  const winnerIsYou = battle.winnerId && String(battle.winnerId) === String(me?.user?._id);

  return (
    <div className="min-h-screen bg-[#090e19] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1422]/95 backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3"><NavLink to="/battle-arena" className="rounded-xl p-2 text-slate-400 hover:bg-white/10" aria-label="Back to Battle Arena"><ArrowLeft className="h-4 w-4" /></NavLink><div><p className="text-sm font-bold">{battle.subject} · {battle.difficulty}</p><p className="text-xs text-slate-400">{battle.mode === 'friend' ? 'Friend challenge' : 'Random match'} · {user?.firstName}</p></div></div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${socketConnected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{socketConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{socketConnected ? 'Live' : 'Reconnecting'}</span><span className="hidden text-xs text-slate-400 sm:inline">{opponent?.user?.firstName || 'Opponent'} · {opponentConnected}</span><span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 font-mono text-sm"><Clock3 className="h-4 w-4 text-amber-300" />{secondsLeft == null ? '--:--' : clock(secondsLeft)}</span><button type="button" onClick={toggleFullscreen} className="rounded-xl bg-white/5 p-2 text-slate-300 hover:bg-white/10" title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><Expand className="h-4 w-4" /></button>{['MATCHED', 'COUNTDOWN'].includes(battle.status) && <button onClick={() => setShowCancel(true)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">Cancel match</button>}</div>
      </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-2 text-xs text-slate-400"><div className="flex gap-5">{scoreRows.map((player) => <span key={player.user?._id} className={player.isYou ? 'font-semibold text-blue-200' : ''}>{player.isYou ? 'You' : player.user?.firstName}: {player.score} pts · {player.acceptedCount} solved</span>)}</div><span className="hidden sm:inline">{battle.status.replaceAll('_', ' ').toLowerCase()}</span></div>
      </header>
      {presenceEvent && <div className="border-b border-blue-400/10 bg-blue-400/5 px-5 py-2 text-xs text-blue-100">{presenceEvent}</div>}
      {error && <div role="alert" className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-100"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}

      {battle.status !== 'ACTIVE' && !finished ? <main className="grid min-h-[65vh] place-items-center p-6"><div className="max-w-lg text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-500/10 text-blue-300"><ShieldCheck className="h-8 w-8" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-widest text-blue-300">{battle.status === 'MATCHED' ? 'Opponent found' : 'Get ready'}</p><h1 className="mt-2 text-3xl font-extrabold">{secondsLeft > 0 ? `${clock(secondsLeft)} until start` : 'Starting your battle…'}</h1><p className="mt-3 text-sm leading-6 text-slate-400">Both players have the same {battle.questions.length} question{battle.questions.length === 1 ? '' : 's'}. Your editor and drafts are private to you.</p></div></main> : finished ? <main className="mx-auto max-w-4xl px-5 py-14"><div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center"><p className="text-xs font-bold uppercase tracking-widest text-blue-300">Battle complete</p><h1 className="mt-3 text-4xl font-extrabold">{battle.status === 'CANCELLED' ? 'Match cancelled' : !battle.winnerId ? 'Draw game' : winnerIsYou ? 'Victory' : 'Battle lost'}</h1><p className="mt-3 text-sm text-slate-400">{battle.resultReason?.replaceAll('_', ' ')} · {battle.subject} · {battle.difficulty}</p><div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-3">{scoreRows.map((player) => <div key={player.user?._id} className="rounded-2xl bg-white/5 p-4"><p className="text-sm font-semibold">{player.isYou ? 'You' : player.user?.firstName}</p><p className="mt-2 font-mono text-2xl font-bold text-blue-200">{player.score}</p><p className="text-xs text-slate-500">{player.acceptedCount} solved</p></div>)}</div><NavLink to="/battle-arena" className="mt-7 inline-flex rounded-xl bg-[#2147ba] px-5 py-3 text-sm font-semibold text-white">Back to arena</NavLink></div></main> : (
        <main className="grid min-h-[calc(100vh-110px)] lg:grid-cols-[minmax(320px,0.9fr)_minmax(460px,1.1fr)]">
          <section className="flex min-h-[42vh] flex-col border-b border-white/10 lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">{battle.questions.map((question, index) => <button key={question._id} onClick={() => changeQuestion(question)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${question._id === currentQuestion?._id ? 'bg-[#2147ba] text-white' : 'text-slate-400 hover:bg-white/5'}`}>Q{index + 1}<span className="ml-1.5 opacity-70">{question.points} pts</span></button>)}</div>
            <div className="flex gap-4 border-b border-white/10 px-4 py-3 text-xs"><button onClick={() => setActiveTab('problem')} className={activeTab === 'problem' ? 'font-semibold text-white' : 'text-slate-400'}>Problem</button><button onClick={() => setActiveTab('tests')} className={activeTab === 'tests' ? 'font-semibold text-white' : 'text-slate-400'}>Visible tests</button></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">{activeTab === 'problem' ? <div className="mx-auto max-w-3xl"><h1 className="text-2xl font-bold">{currentQuestion?.title}</h1><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{currentQuestion?.description}</div>{currentQuestion?.constraints && <div className="mt-7"><h2 className="mb-2 text-sm font-semibold">Constraints</h2><pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-300">{currentQuestion.constraints}</pre></div>}{currentQuestion?.examples?.map((example, index) => <div key={index} className="mt-7"><h2 className="mb-2 text-sm font-semibold">Example {index + 1}</h2><div className="grid rounded-xl border border-white/10 bg-white/[0.03] text-xs sm:grid-cols-2"><div className="p-4"><p className="mb-2 text-slate-500">Input</p><pre className="whitespace-pre-wrap">{example.input}</pre></div><div className="border-t border-white/10 p-4 sm:border-l sm:border-t-0"><p className="mb-2 text-slate-500">Output</p><pre className="whitespace-pre-wrap">{example.output}</pre></div>{example.explanation && <p className="border-t border-white/10 p-4 text-slate-400 sm:col-span-2">{example.explanation}</p>}</div></div>)}<div className="mt-8 flex justify-between border-t border-white/10 pt-4"><button disabled={questionIndex <= 0} onClick={() => changeQuestion(battle.questions[questionIndex - 1])} className="inline-flex items-center gap-1 text-xs text-slate-400 disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Previous</button><button disabled={questionIndex >= battle.questions.length - 1} onClick={() => changeQuestion(battle.questions[questionIndex + 1])} className="inline-flex items-center gap-1 text-xs text-slate-400 disabled:opacity-30">Next<ChevronRight className="h-4 w-4" /></button></div></div> : <div className="space-y-4">{currentQuestion?.visibleTestCases?.map((test, index) => <article key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="mb-3 text-xs font-semibold">Visible test {index + 1}</p><div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-1 text-[11px] text-slate-500">Input</p><pre className="whitespace-pre-wrap text-xs">{test.input}</pre></div><div><p className="mb-1 text-[11px] text-slate-500">Expected output</p><pre className="whitespace-pre-wrap text-xs">{test.output}</pre></div></div></article>)}</div>}</div>
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-400"><span>Independent editor · Draft {saveStatus}</span><span>{opponentConnected === 'connected' ? 'Opponent online' : 'Opponent disconnected'}</span></div>
          </section>
          <section className="flex min-h-[65vh] flex-col lg:min-h-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><span className="text-xs text-slate-300">Your private workspace · {labels[language]}</span><select value={language} disabled={!canEdit} onChange={(event) => changeLanguage(event.target.value)} className="rounded-lg border border-white/10 bg-[#131d2d] px-3 py-2 text-xs text-slate-200">{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            <div className="min-h-[320px] flex-1"><Editor height="100%" language={editorLanguages[language]} value={currentCode} onChange={(value) => changeCode(value || '')} theme="vs-dark" options={{ readOnly: !canEdit, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, insertSpaces: true, wordWrap: 'on', padding: { top: 16, bottom: 16 } }} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 bg-[#0d1422] px-4 py-3"><div className="flex gap-2"><button onClick={runCode} disabled={!canEdit} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold disabled:opacity-40"><Play className="h-3.5 w-3.5" />Run</button><button onClick={submitCode} disabled={!canEdit || busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Evaluating…' : <><Send className="h-3.5 w-3.5" />Submit</>}</button></div><span className="text-xs text-slate-500">{me?.acceptedCount || 0}/{battle.questions.length} solved</span></div>
            <div className="min-h-[160px] flex-1 overflow-y-auto bg-[#0b111d] p-4"><div className="mb-3 flex gap-4 text-xs"><button onClick={() => setConsoleTab('run')} className={consoleTab === 'run' ? 'font-semibold text-white' : 'text-slate-500'}>Execution</button><button onClick={() => setConsoleTab('submission')} className={consoleTab === 'submission' ? 'font-semibold text-white' : 'text-slate-500'}>Submission result</button></div>{consoleTab === 'run' && (!runResult ? <p className="text-xs text-slate-500">Run checks only visible examples.</p> : runResult.loading ? <p className="text-xs text-slate-400">Running on Judge0…</p> : runResult.error ? <p className="text-xs text-red-300">{runResult.error}</p> : <div className="space-y-2">{runResult.testCases?.map((test, index) => <div key={index} className="flex flex-wrap items-center gap-2 text-xs"><CheckCircle2 className={`h-3.5 w-3.5 ${test.passed ? 'text-emerald-400' : 'text-red-400'}`} /><span>{`Test ${index + 1}: ${test.status}`}</span><code className="ml-auto max-w-full truncate text-slate-400">{test.actualOutput}</code></div>)}</div>)}{consoleTab === 'submission' && (submission ? <div><p className={`text-sm font-semibold ${submission.status === 'accepted' ? 'text-emerald-300' : 'text-amber-200'}`}>{submission.status} · {submission.testCasesPassed}/{submission.testCasesTotal} hidden tests</p><p className="mt-1 text-xs text-slate-400">Score change {submission.scoreDelta > 0 ? '+' : ''}{submission.scoreDelta} · Your score {submission.score}</p>{submission.errorMessage && <p className="mt-2 text-xs text-red-300">{submission.errorMessage}</p>}</div> : <p className="text-xs text-slate-500">Submit a solution to see its verified result.</p>)}</div>
          </section>
        </main>
      )}
      <footer className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />Scores and winner are decided by verified server results. Your source is never sent to your opponent.</footer>
      {showCancel && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121c2c] p-6"><h2 className="text-lg font-bold">Cancel this match?</h2><p className="mt-2 text-sm text-slate-400">You can cancel before the countdown ends.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowCancel(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Keep match</button><button onClick={cancelBeforeStart} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold">Cancel match</button></div></div></div>}
    </div>
  );
}

export default BattleRoom;
