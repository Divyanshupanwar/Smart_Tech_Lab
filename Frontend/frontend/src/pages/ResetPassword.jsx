import { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Code, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import axiosClient from '../utils/axiosClient';
import { checkAuth } from '../authSlice';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function ResetPassword() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async ({ password }) => {
    setLoading(true);
    setErrorMessage('');

    try {
      await axiosClient.post(`/user/reset-password/${token}`, { password });
      await dispatch(checkAuth());
      navigate('/');
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || 'We could not reset your password. Please request a new link.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen page-shell flex items-center justify-center p-4">
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
            <p className="eyebrow-pill mb-4">Create a new password</p>
            <h2 className="page-title text-3xl font-bold mb-1">Reset password</h2>
            <p className="page-subtitle text-sm">
              Use a strong password you haven&apos;t used before.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">New password</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  className={`input-luxe w-full py-3 pl-11 pr-12 text-sm ${errors.password ? 'border-red-300 bg-red-50' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-700"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Confirm password</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="********"
                  className={`input-luxe w-full py-3 pl-11 pr-12 text-sm ${errors.confirmPassword ? 'border-red-300 bg-red-50' : ''}`}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-700"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button type="submit" className="w-full btn-professional py-3.5" disabled={loading}>
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Save New Password <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-stone-200/80 pt-6 text-center">
            <NavLink to="/login" className="text-sm font-semibold text-[#2147ba] transition-colors hover:text-[#173483]">
              Back to login
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
