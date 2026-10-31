import {Routes, Route, Navigate, useLocation, useNavigate} from "react-router";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import LandingPage from "./pages/LandingPage";
import SubjectSelection from "./pages/SubjectSelection";
import SubjectProblems from "./pages/SubjectProblems";
import UserProgress from "./pages/UserProgress";
import Assignments from "./pages/Assignments";
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from "./authSlice";
import { useEffect, useRef, useState } from "react";
import axiosClient from "./utils/axiosClient";
import AdminPanel from "./components/AdminPanel";
import ProblemPage from "./pages/ProblemPage"
import Admin from "./pages/Admin";
import AdminVideo from "./components/AdminVideo"
import AdminDelete from "./components/AdminDelete"
import AdminUpload from "./components/AdminUpload"
import AdminAssignment from "./components/AdminAssignment"
import AdminLabExams from "./components/AdminLabExams"
import LabPracticals from "./pages/LabPracticals"
import LabExamInstructions from "./pages/LabExamInstructions"
import LabExamRoom from "./pages/LabExamRoom"
import BattleArena from "./pages/BattleArena"
import BattleRoom from "./pages/BattleRoom"

function App(){
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {isAuthenticated,user,loading} = useSelector((state)=>state.auth);
  const [activeExamAttempt, setActiveExamAttempt] = useState(null);
  const navigationEventPending = useRef(false);

  // check initial authentication
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'user') {
      setActiveExamAttempt(null);
      return undefined;
    }
    let active = true;
    const refreshActiveAttempt = async () => {
      try {
        const { data } = await axiosClient.get('/lab-exams/attempts/active');
        if (active) setActiveExamAttempt(data.attempt || null);
      } catch {
        if (active) setActiveExamAttempt(null);
      }
    };
    refreshActiveAttempt();
    const interval = window.setInterval(refreshActiveAttempt, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    const onAttemptStarted = (event) => setActiveExamAttempt(event.detail || null);
    window.addEventListener('exam:attempt-started', onAttemptStarted);
    return () => window.removeEventListener('exam:attempt-started', onAttemptStarted);
  }, []);

  useEffect(() => {
    if (!activeExamAttempt || !isAuthenticated || user?.role !== 'user') return;
    const protectedPath = `/lab-practicals/${activeExamAttempt.examId}/attempt/${activeExamAttempt._id}`;
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    if (location.pathname === protectedPath || navigationEventPending.current) return;

    navigationEventPending.current = true;
    navigate(protectedPath, { replace: true });
    axiosClient.post(`/lab-exams/attempts/${activeExamAttempt._id}/proctoring-events`, {
      eventType: 'route_navigation',
      metadata: { attemptedPath: location.pathname }
    }).then(({ data }) => {
      if (data.terminated) {
        setActiveExamAttempt(null);
        navigate(currentPath, { replace: true });
      }
    }).catch((error) => {
      if ([401, 410].includes(error.response?.status)) {
        setActiveExamAttempt(null);
        navigate(currentPath, { replace: true });
      }
    }).finally(() => { navigationEventPending.current = false; });
  }, [activeExamAttempt, isAuthenticated, location.hash, location.pathname, location.search, navigate, user?.role]);

  useEffect(() => {
    if (!activeExamAttempt || !isAuthenticated || user?.role !== 'user') return undefined;
    const protectDocumentExit = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDocumentExit);
    return () => window.removeEventListener('beforeunload', protectDocumentExit);
  }, [activeExamAttempt, isAuthenticated, user?.role]);
  
  if (loading) {
    return <div className="min-h-screen page-shell flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-[3px] border-stone-300 border-t-[#2147ba] rounded-full animate-spin"></div>
        <p className="text-sm text-stone-600 font-semibold">Loading Smart Tech Lab...</p>
      </div>
    </div>;
  }

  return(
  <>
    <Routes>
      {/* Public Routes */}
      <Route path="/landing" element={isAuthenticated ? <Navigate to="/" /> : <LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <Signup />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/" /> : <ForgotPassword />} />
      <Route path="/reset-password/:token" element={isAuthenticated ? <Navigate to="/" /> : <ResetPassword />} />

      {/* Protected Routes - Subject Selection (Home after login) */}
      <Route path="/" element={isAuthenticated ? <SubjectSelection /> : <LandingPage />} />
      
      {/* Subject Problems */}
      <Route path="/subject/:subject" element={isAuthenticated ? <SubjectProblems /> : <Navigate to="/landing" />} />
      
      {/* Problem Page */}
      <Route path="/problem/:problemId" element={isAuthenticated ? <ProblemPage /> : <Navigate to="/landing" />} />

      {/* User Progress */}
      <Route path="/progress" element={isAuthenticated ? <UserProgress /> : <Navigate to="/landing" />} />

      {/* Assignments */}
      <Route path="/assignments" element={isAuthenticated ? <Assignments /> : <Navigate to="/landing" />} />

      {/* Lab practical examinations */}
      <Route path="/lab-practicals" element={isAuthenticated ? <LabPracticals /> : <Navigate to="/landing" />} />
      <Route path="/lab-practicals/:examId/instructions" element={isAuthenticated ? <LabExamInstructions /> : <Navigate to="/landing" />} />
      <Route path="/lab-practicals/:examId/attempt/:attemptId" element={isAuthenticated ? <LabExamRoom /> : <Navigate to="/landing" />} />

      {/* Student coding battles */}
      <Route path="/battle-arena" element={isAuthenticated && user?.role === 'user' ? <BattleArena /> : <Navigate to="/" />} />
      <Route path="/battle/:battleId" element={isAuthenticated && user?.role === 'user' ? <BattleRoom /> : <Navigate to="/" />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={isAuthenticated && user?.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
      <Route path="/admin/lab-exams" element={isAuthenticated && ['admin', 'teacher'].includes(user?.role) ? <AdminLabExams /> : <Navigate to="/" />} />
      <Route path="/admin/create" element={isAuthenticated && user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
      <Route path="/admin/delete" element={isAuthenticated && user?.role === 'admin' ? <AdminDelete /> : <Navigate to="/" />} />
      <Route path="/admin/video" element={isAuthenticated && user?.role === 'admin' ? <AdminVideo /> : <Navigate to="/" />} />
      <Route path="/admin/upload/:problemId" element={isAuthenticated && user?.role === 'admin' ? <AdminUpload /> : <Navigate to="/" />} />
      <Route path="/admin/assignment" element={isAuthenticated && user?.role === 'admin' ? <AdminAssignment /> : <Navigate to="/" />} />
    </Routes>
  </>
  )
}

export default App;
