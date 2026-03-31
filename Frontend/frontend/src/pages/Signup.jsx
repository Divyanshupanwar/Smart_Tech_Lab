import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router';
import { registerUser, clearError } from '../authSlice';
import { Code, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

const signupSchema = z.object({
  firstName: z.string().min(3, "Name must be at least 3 characters"),
  emailID: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character")
});

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signupSchema) });

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = (data) => {
    dispatch(registerUser({
      firstName: data.firstName,
      emailID: data.emailID,
      password: data.password,
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <NavLink to="/landing" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Code className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Smart Tech Lab</span>
          </NavLink>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h2>
          <p className="text-slate-500 text-sm mb-8">Start your coding journey today</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm font-medium">
                {typeof error === 'string' ? error : 'Registration failed. Please try again.'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className={`w-full px-4 py-3 rounded-xl border ${errors.firstName ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all`}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1.5">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className={`w-full px-4 py-3 rounded-xl border ${errors.emailID ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all`}
                {...register('emailID')}
              />
              {errors.emailID && (
                <p className="text-red-500 text-xs mt-1.5">{errors.emailID.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 pr-12 rounded-xl border ${errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all`}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
              )}
              <p className="text-xs text-slate-400 mt-2">Must include uppercase, number, and special character</p>
            </div>

            <button
              type="submit"
              className="w-full btn-professional flex items-center justify-center gap-2 py-3.5"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="text-center mt-8 pt-6 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Already have an account?{' '}
              <NavLink to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
                Login
              </NavLink>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;