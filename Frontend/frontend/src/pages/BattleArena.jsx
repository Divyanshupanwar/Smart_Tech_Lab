import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { io } from 'socket.io-client';
import { ArrowLeft, Award, ChevronRight, Search, ShieldCheck, Swords, Users, Wifi, X } from 'lucide-react';
import axiosClient from '../utils/axiosClient';

const subjects = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
const difficulties = ['easy', 'medium', 'hard'];
const socketOrigin = () => {
  const base = axiosClient.defaults.baseURL || window.location.origin;
  return base.startsWith('http') ? base.replace(/\/api\/?$/, '') : window.location.origin;
};

function BattleArena() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ subject: 'DSA', difficulty: 'easy', topic: '', durationMinutes: 20, questionCount: 1, playerCount: 4 });
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, totalBattles: 0, rating: 1000 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('global');
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshHome = useCallback(async () => {
    const [invitationResponse, historyResponse, leaderboardResponse] = await Promise.all([
      axiosClient.get('/battle/invitations'),
      axiosClient.get('/battle/history'),
      axiosClient.get('/battle/leaderboard', { params: { period: leaderboardPeriod } }).catch(() => ({ data: { leaderboard: [] } }))
    ]);
    setIncoming(invitationResponse.data.incoming || []);
    setOutgoing(invitationResponse.data.outgoing || []);
    setHistory(historyResponse.data.history || []);
    setStats(historyResponse.data.stats || { wins: 0, losses: 0, draws: 0, totalBattles: 0, rating: 1000 });
    setLeaderboard(leaderboardResponse.data.leaderboard || []);
  }, [leaderboardPeriod]);

  useEffect(() => {
    let active = true;
    refreshHome().catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load the Battle Arena.'); });
    return () => { active = false; };
  }, [refreshHome]);

  useEffect(() => {
    const socket = io(`${socketOrigin()}/battle`, { withCredentials: true, reconnection: true, reconnectionAttempts: Infinity });
    socket.on('connect', () => {
      setConnected(true);
      axiosClient.get('/battle/active').then(({ data }) => { if (data.battle) navigate(`/battle/${data.battle._id}`); }).catch(() => {});
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('battle:matched', ({ battleId }) => { if (battleId) navigate(`/battle/${battleId}`); });
    socket.on('battle:invitation', () => refreshHome().catch(() => {}));
    socket.on('battle:invitation:rejected', () => { setMessage('Your invitation was declined.'); refreshHome().catch(() => {}); });
    return () => socket.disconnect();
  }, [navigate, refreshHome]);

  useEffect(() => {
    if (!waiting) return undefined;
    const check = async () => {
      try {
        const { data } = await axiosClient.get('/battle/active');
        if (data.battle) navigate(`/battle/${data.battle._id}`);
      } catch { /* socket reconnection will retry the active match check */ }
    };
    const interval = window.setInterval(check, 4000);
    return () => window.clearInterval(interval);
  }, [waiting, navigate]);

  useEffect(() => {
    if (query.trim().length < 2) { setStudents([]); return undefined; }
    let active = true;
    const timer = window.setTimeout(() => {
      axiosClient.get('/battle/students', { params: { q: query } })
        .then(({ data }) => { if (active) setStudents(data.students || []); })
        .catch(() => { if (active) setStudents([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const findBattleGroup = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await axiosClient.post('/battle/matchmaking/find', config);
      if (data.battle) navigate(`/battle/${data.battle._id}`);
      else { setWaiting(true); setMessage(`Waiting for ${config.playerCount} players with the same battle settings. Keep this page open or reconnect to resume.`); }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not start matchmaking.');
    } finally { setBusy(false); }
  };

  const cancelQueue = async () => {
    try { await axiosClient.post('/battle/matchmaking/cancel'); setWaiting(false); setMessage('Matchmaking cancelled.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'No waiting queue entry was found.'); }
  };

  const challengeFriend = async () => {
    if (!selectedStudent) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await axiosClient.post('/battle/invitations', { ...config, toUserId: selectedStudent._id });
      setMessage(`Battle invitation sent to ${selectedStudent.firstName}.`);
      setSelectedStudent(null); setQuery(''); setStudents([]);
      await refreshHome();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not send invitation.'); }
    finally { setBusy(false); }
  };

  const respondToInvitation = async (invitation, action) => {
    try {
      const { data } = await axiosClient.post(`/battle/invitations/${invitation._id}/${action}`);
      setIncoming((current) => current.filter((item) => item._id !== invitation._id));
      if (data.battle) navigate(`/battle/${data.battle._id}`);
      else await refreshHome();
    } catch (requestError) { setError(requestError.response?.data?.message || `Could not ${action} invitation.`); }
  };

  return (
    <div className="min-h-screen page-shell mesh-overlay">
      <nav className="sticky top-0 z-40 navbar-glass"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4"><NavLink to="/" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><ArrowLeft className="h-5 w-5" /></NavLink><div className="brand-mark grid h-10 w-10 place-items-center rounded-2xl"><Swords className="h-5 w-5 text-white" /></div><div><p className="font-display font-bold text-stone-950">Battle Arena</p><p className="text-xs text-stone-500">Live multiplayer coding battles</p></div><span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{connected ? <Wifi className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-stone-400" />}{connected ? 'Live connection' : 'Connecting'}</span></div></nav>
      <main className="mx-auto max-w-7xl space-y-8 px-5 py-9">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0c1732] via-[#163779] to-[#2147ba] p-8 text-white md:p-10"><div className="absolute -right-8 -top-20 h-72 w-72 rounded-full border border-white/10" /><div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Swords className="h-3.5 w-3.5" /> Queue up · solve fast · climb</span><h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Think fast.<br />Code sharper.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">Compete on the same questions under the same timer. Your score and winner are verified by the server.</p></div><div className="grid grid-cols-3 gap-3">{[['Wins', stats.wins], ['Battles', stats.totalBattles], ['Rating', stats.rating]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center"><p className="text-[11px] uppercase tracking-wider text-blue-100">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div></div></section>
        {(error || message) && <div role={error ? 'alert' : 'status'} className={`flex items-center justify-between rounded-xl border p-4 text-sm ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-blue-100 bg-blue-50 text-blue-900'}`}><span>{error || message}</span><button onClick={() => { setError(''); setMessage(''); }} aria-label="Dismiss" className="ml-3"><X className="h-4 w-4" /></button></div>}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="grid gap-6 md:grid-cols-2">
            <article className="card-professional p-6"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Users className="h-5 w-5" /></div><div><h2 className="font-bold text-stone-900">Join a group battle</h2><p className="text-xs text-stone-500">Match with students using the same settings</p></div></div>
              <div className="mt-5 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-stone-600">Subject<select value={config.subject} onChange={(event) => setConfig((current) => ({ ...current, subject: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal">{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label><label className="text-xs font-semibold text-stone-600">Difficulty<select value={config.difficulty} onChange={(event) => setConfig((current) => ({ ...current, difficulty: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal">{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label className="text-xs font-semibold text-stone-600">Topic (optional)<input value={config.topic} onChange={(event) => setConfig((current) => ({ ...current, topic: event.target.value }))} placeholder="array, graph…" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal" /></label><label className="text-xs font-semibold text-stone-600">Duration<input type="number" min="1" max="180" value={config.durationMinutes} onChange={(event) => setConfig((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal" /></label><label className="text-xs font-semibold text-stone-600">Questions<select value={config.questionCount} onChange={(event) => setConfig((current) => ({ ...current, questionCount: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal">{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><label className="text-xs font-semibold text-stone-600">Players per battle<select value={config.playerCount} onChange={(event) => setConfig((current) => ({ ...current, playerCount: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal">{[2, 3, 4, 6, 8, 12, 16].map((count) => <option key={count} value={count}>{count} players</option>)}</select></label></div>
              {waiting ? <button onClick={cancelQueue} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><X className="h-4 w-4" />Cancel search</button> : <button onClick={findBattleGroup} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2147ba] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Search className="h-4 w-4" />{busy ? 'Searching…' : 'Join group'}</button>}
            </article>
            <article className="card-professional p-6"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><Swords className="h-5 w-5" /></div><div><h2 className="font-bold text-stone-900">Challenge a friend</h2><p className="text-xs text-stone-500">Invitation expires in two minutes</p></div></div>
              <label className="mt-5 block text-xs font-semibold text-stone-600">Search students<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or school email" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-normal" /></label>
              {students.length > 0 && <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-stone-100">{students.map((student) => <button key={student._id} onClick={() => { setSelectedStudent(student); setStudents([]); }} className="flex w-full items-center justify-between border-b border-stone-100 px-3 py-2.5 text-left last:border-0 hover:bg-stone-50"><span><span className="block text-sm font-semibold text-stone-800">{student.firstName} {student.lastName}</span><span className="text-xs text-stone-500">{student.emailID}</span></span><ChevronRight className="h-4 w-4 text-stone-400" /></button>)}</div>}
              {selectedStudent && <div className="mt-3 flex items-center justify-between rounded-xl bg-violet-50 p-3 text-sm text-violet-900"><span>{selectedStudent.firstName} {selectedStudent.lastName}</span><button onClick={() => setSelectedStudent(null)}><X className="h-4 w-4" /></button></div>}
              <button onClick={challengeFriend} disabled={!selectedStudent || busy} className="mt-5 w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 disabled:opacity-40">Send invitation</button>
              <p className="mt-3 text-xs leading-5 text-stone-500">Direct friend invitations remain duels. Use group matchmaking to compete with 2–16 students.</p>
            </article>
          </section>
          <section className="space-y-6">
            <article className="card-professional p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-stone-900">Incoming challenges</h2><p className="mt-1 text-xs text-stone-500">Accept or pass on a friend’s invitation.</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{incoming.length}</span></div>
              {incoming.length ? <div className="space-y-3">{incoming.map((invitation) => <div key={invitation._id} className="rounded-xl border border-stone-100 p-3"><p className="text-sm font-semibold text-stone-900">{invitation.fromUserId?.firstName} {invitation.fromUserId?.lastName} challenged you</p><p className="mt-1 text-xs text-stone-500">{invitation.subject} · {invitation.difficulty} · {invitation.durationMinutes} min · {invitation.questionCount} Q</p><div className="mt-3 flex gap-2"><button onClick={() => respondToInvitation(invitation, 'accept')} className="rounded-lg bg-[#2147ba] px-3 py-2 text-xs font-semibold text-white">Accept</button><button onClick={() => respondToInvitation(invitation, 'reject')} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600">Decline</button></div></div>)}</div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">No incoming invitations.</p>}
              {outgoing.length > 0 && <div className="mt-5 border-t border-stone-100 pt-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">Sent invitations</h3><div className="space-y-2">{outgoing.slice(0, 4).map((invitation) => <div key={invitation._id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2"><span className="text-xs text-stone-700">{invitation.toUserId?.firstName} {invitation.toUserId?.lastName}</span><span className="text-[11px] font-semibold capitalize text-stone-500">{invitation.status}</span></div>)}</div></div>}
            </article>
            <article className="card-professional p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-stone-900">Leaderboard</h2><p className="mt-1 text-xs text-stone-500">{leaderboardPeriod === 'weekly' ? 'Current week · points earned' : 'All time · rating'}</p></div><Award className="h-5 w-5 text-amber-500" /></div><div className="mb-4 flex gap-2"><button onClick={() => setLeaderboardPeriod('global')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${leaderboardPeriod === 'global' ? 'bg-blue-50 text-blue-800' : 'text-stone-500'}`}>Global</button><button onClick={() => setLeaderboardPeriod('weekly')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${leaderboardPeriod === 'weekly' ? 'bg-blue-50 text-blue-800' : 'text-stone-500'}`}>Weekly</button></div>
              {leaderboard.length ? <div className="space-y-2">{leaderboard.slice(0, 5).map((entry) => <div key={entry.student?._id} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5"><span className="flex items-center gap-3 text-sm"><span className="w-6 text-center text-xs font-bold text-stone-400">{entry.rank}</span><span><span className="block font-semibold text-stone-800">{entry.student?.firstName} {entry.student?.lastName}</span><span className="text-[11px] text-stone-500">{entry.stats?.wins || 0}W · {entry.stats?.losses || 0}L · {entry.stats?.totalBattles || 0} battles</span></span></span><span className="font-mono text-xs font-semibold text-blue-700">{entry.score}</span></div>)}</div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Finish a battle to appear on the leaderboard.</p>}
            </article>
          </section>
        </div>
        <section className="card-professional p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-stone-900">Battle history</h2><p className="mt-1 text-xs text-stone-500">Completed matches and result details.</p></div><NavLink to="/battle-arena" className="text-xs font-semibold text-blue-700">{history.length} matches</NavLink></div>
          {history.length ? <div className="grid gap-3 md:grid-cols-2">{history.slice(0, 8).map((battle) => { const self = battle.players?.find((player) => player.isYou); const winners = (battle.winnerIds || []).map(String); if (!winners.length && battle.winnerId) winners.push(String(battle.winnerId)); const isWinner = winners.includes(String(self?.user?._id)); return <NavLink key={battle._id} to={`/battle/${battle._id}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 p-4 hover:border-blue-100"><div><p className="text-sm font-semibold text-stone-800">Battle with {battle.players?.length || 0} players</p><p className="mt-1 text-xs text-stone-500">Score {self?.score || 0} · Solved {self?.acceptedCount || 0}/{battle.questions?.length || 0} · {battle.durationMinutes} min</p><p className="mt-1 text-xs text-stone-500">{battle.subject} · {battle.difficulty} · {new Date(battle.completedAt).toLocaleDateString()}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${winners.length === 0 ? 'bg-stone-100 text-stone-600' : isWinner ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{winners.length === 0 ? 'Draw' : winners.length > 1 && isWinner ? 'Tied' : isWinner ? 'Won' : 'Lost'}</span></NavLink>; })}</div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Your completed battles will appear here.</p>}
        </section>
        <div className="flex items-center gap-2 text-xs text-stone-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Question results and scoring are verified by the server and Judge0.</div>
      </main>
    </div>
  );
}

export default BattleArena;
