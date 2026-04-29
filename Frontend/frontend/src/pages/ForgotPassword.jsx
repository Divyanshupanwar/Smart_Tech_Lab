import { useState } from 'react';
import { NavLink } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Code, Mail } from 'lucide-react';
import axiosClient from '../utils/axiosClient';

const forgotPasswordSchema = z.object({
  emailID: z.string().email('Please enter a valid email'),
});

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await axiosClient.post('/user/forgot-password', data);
      setSuccessMessage(response.data.message);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || 'We could not send the reset email right now. Please try again.'
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
            <p className="eyebrow-pill mb-4">Password recovery</p>
            <h2 className="page-title text-3xl font-bold mb-1">Forgot your password?</h2>
            <p className="page-subtitle text-sm">
              Enter your email and we&apos;ll send you a secure reset link.
            </p>
          </div>

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm font-semibold text-emerald-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  className={`input-luxe w-full py-3 pl-11 pr-4 text-sm ${errors.emailID ? 'border-red-300 bg-red-50' : ''}`}
                  {...register('emailID')}
                />
              </div>
              {errors.emailID && <p className="mt-1.5 text-xs text-red-500">{errors.emailID.message}</p>}
            </div>

            <button type="submit" className="w-full btn-professional py-3.5" disabled={loading}>
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Send Reset Link <ArrowRight className="h-4 w-4" />
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

export default ForgotPassword;
