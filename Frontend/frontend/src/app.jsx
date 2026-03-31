import {Routes, Route, Navigate} from "react-router";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import LandingPage from "./pages/LandingPage";
import SubjectSelection from "./pages/SubjectSelection";
import SubjectProblems from "./pages/SubjectProblems";
import UserProgress from "./pages/UserProgress";
import Assignments from "./pages/Assignments";
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from "./authSlice";
import { useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import ProblemPage from "./pages/ProblemPage"
import Admin from "./pages/Admin";
import AdminVideo from "./components/AdminVideo"
import AdminDelete from "./components/AdminDelete"
import AdminUpload from "./components/AdminUpload"
import AdminAssignment from "./components/AdminAssignment"

function App(){
  
  const dispatch = useDispatch();
  const {isAuthenticated,user,loading} = useSelector((state)=>state.auth);

  // check initial authentication
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Loading Smart Tech Lab...</p>
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
      
      {/* Admin Routes */}
      <Route path="/admin" element={isAuthenticated && user?.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
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