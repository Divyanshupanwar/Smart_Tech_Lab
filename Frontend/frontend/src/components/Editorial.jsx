import { useState, useRef, useEffect } from 'react';
import { Pause, Play } from 'lucide-react';

const Editorial = ({ secureUrl, thumbnailUrl, duration }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const handleTimeUpdate = () => {
      if (video) setCurrentTime(video.currentTime);
    };
    if (video) {
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, []);

  if (!secureUrl) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">No editorial video available for this problem yet.</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden border border-slate-200"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={videoRef}
        src={secureUrl}
        poster={thumbnailUrl}
        onClick={togglePlayPause}
        className="w-full aspect-video bg-slate-900 cursor-pointer"
      />

      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity ${isHovering || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={togglePlayPause}
          className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-all mr-3"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-4 h-4 text-slate-900" /> : <Play className="w-4 h-4 text-slate-900 ml-0.5" />}
        </button>

        <div className="flex items-center w-full mt-2 gap-2">
          <span className="text-white text-xs font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={(e) => {
              if (videoRef.current) {
                videoRef.current.currentTime = Number(e.target.value);
              }
            }}
            className="flex-1 h-1 appearance-none bg-white/30 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
          <span className="text-white text-xs font-mono">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default Editorial;