import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router';
import { registerUser, clearError } from '../authSlice';
import { Code, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import InteractiveDotField from '../components/InteractiveDotField';

const signupSchema = z.object({
  firstName: z.string().min(3, 'Name must be at least 3 characters'),
  emailID: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
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
    <div className="min-h-screen page-shell flex items-center justify-center p-4">
      <InteractiveDotField className="interactive-dot-soft-mask opacity-70" density="light" centerX={0.5} centerY={0.42} />
      <div className="w-full max-w-md animate-scale-in page-content">
        <div className="text-center mb-8">
          <NavLink to="/landing" className="inline-flex items-center gap-3">
            <div className="brand-mark w-12 h-12 rounded-2xl flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-stone-950">Smart Tech Lab</span>
          </NavLink>
        </div>

        <div className="surface-panel p-8">
          <div className="mb-8">
            <p className="eyebrow-pill mb-4">Create account</p>
            <h2 className="page-title text-3xl font-bold mb-1">Join the lab</h2>
            <p className="page-subtitle text-sm">Clean typography, bright workspace, and subject-based practice from day one.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50/80 border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm font-semibold">
                {typeof error === 'string' ? error : 'Registration failed. Please try again.'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className={`input-luxe w-full px-4 py-3 text-sm ${errors.firstName ? 'border-red-300 bg-red-50' : ''}`}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1.5">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className={`input-luxe w-full px-4 py-3 text-sm ${errors.emailID ? 'border-red-300 bg-red-50' : ''}`}
                {...register('emailID')}
              />
              {errors.emailID && (
                <p className="text-red-500 text-xs mt-1.5">{errors.emailID.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  className={`input-luxe w-full px-4 py-3 pr-12 text-sm ${errors.password ? 'border-red-300 bg-red-50' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
              )}
              <p className="text-xs text-stone-500 mt-2">Must include uppercase, number, and special character.</p>
            </div>

            <button
              type="submit"
              className="w-full btn-professional py-3.5"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="text-center mt-8 pt-6 border-t border-stone-200/80">
            <span className="text-sm text-stone-600">
              Already have an account?{' '}
              <NavLink to="/login" className="text-[#2147ba] font-semibold hover:text-[#173483] transition-colors">
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
