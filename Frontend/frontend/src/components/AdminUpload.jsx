import { useParams, NavLink } from 'react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import axiosClient from '../utils/axiosClient';
import { ArrowLeft, Code, Upload, CheckCircle2 } from 'lucide-react';

function AdminUpload() {
  const { problemId } = useParams();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideo, setUploadedVideo] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setError,
    clearErrors
  } = useForm();

  const selectedFile = watch('videoFile')?.[0];

  const onSubmit = async (data) => {
    const file = data.videoFile[0];
    setUploading(true);
    setUploadProgress(0);
    clearErrors();

    try {
      const signatureResponse = await axiosClient.get(`/video/create/${problemId}`);
      const { signature, timestamp, public_id, api_key, cloud_name, upload_url } = signatureResponse.data;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp);
      formData.append('public_id', public_id);
      formData.append('api_key', api_key);

      const uploadResponse = await axios.post(upload_url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const cloudinaryResult = uploadResponse.data;

      const metadataResponse = await axiosClient.post('/video/save', {
        problemId,
        cloudinaryPublicId: cloudinaryResult.public_id,
        secureUrl: cloudinaryResult.secure_url,
        duration: cloudinaryResult.duration,
      });

      setUploadedVideo(metadataResponse.data.videoSolution);
      reset();
    } catch (err) {
      console.error('Upload error:', err);
      setError('root', {
        type: 'manual',
        message: err.response?.data?.message || 'Upload failed. Please try again.'
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <NavLink to="/admin/video" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </NavLink>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900">Upload Video</span>
            <p className="text-xs text-slate-400">Upload editorial video for this problem</p>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="card-professional p-8 animate-scale-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Upload Video</h2>
              <p className="text-xs text-slate-400">Max file size: 100MB</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Choose video file</label>
              <input
                type="file"
                accept="video/*"
                {...register('videoFile', {
                  required: 'Please select a video file',
                  validate: {
                    isVideo: (files) => {
                      if (!files || !files[0]) return 'Please select a video file';
                      return files[0].type.startsWith('video/') || 'Please select a valid video file';
                    },
                    fileSize: (files) => {
                      if (!files || !files[0]) return true;
                      return files[0].size <= 100 * 1024 * 1024 || 'File size must be less than 100MB';
                    }
                  }
                })}
                className={`w-full px-4 py-3 rounded-xl border ${errors.videoFile ? 'border-red-300' : 'border-slate-200'} bg-slate-50 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100`}
                disabled={uploading}
              />
              {errors.videoFile && <p className="text-red-500 text-xs mt-1">{errors.videoFile.message}</p>}
            </div>

            {selectedFile && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm">
                <p className="font-medium text-blue-700">{selectedFile.name}</p>
                <p className="text-blue-500 text-xs">{formatFileSize(selectedFile.size)}</p>
              </div>
            )}

            {uploading && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {errors.root && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{errors.root.message}</div>
            )}

            {uploadedVideo && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700 text-sm">Upload Successful!</p>
                  <p className="text-emerald-600 text-xs">Duration: {formatDuration(uploadedVideo.duration)}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full btn-professional flex items-center justify-center gap-2 py-3.5 disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Upload className="w-4 h-4" /> Upload Video</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminUpload;