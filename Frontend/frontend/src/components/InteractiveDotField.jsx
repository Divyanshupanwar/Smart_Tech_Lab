import { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const COLORS = ['#2147ba', '#4f46e5', '#7c3aed', '#d9466f', '#ef4444'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  const int = Number.parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgba = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const colorForDot = (ringProgress, angleProgress) => {
  const index = Math.floor((ringProgress * 0.55 + angleProgress * 0.45) * (COLORS.length - 1));
  return COLORS[clamp(index, 0, COLORS.length - 1)];
};

const buildDots = (width, height, density) => {
  const shortestSide = Math.min(width, height);
  const maxRadius = Math.min(width * 0.42, height * 0.56);
  const minRadius = Math.max(42, shortestSide * 0.07);
  const ringCount = density === 'dense' ? 10 : density === 'medium' ? 8 : 6;
  const dots = [];

  for (let ring = 0; ring < ringCount; ring += 1) {
    const ringProgress = ringCount === 1 ? 1 : ring / (ringCount - 1);
    const radius = minRadius + (maxRadius - minRadius) * Math.pow(ringProgress, 0.95);
    const ellipseRatio = 0.64 + ringProgress * 0.18;
    const count = Math.round((density === 'dense' ? 28 : 18) + ring * (density === 'dense' ? 14 : 10));

    for (let index = 0; index < count; index += 1) {
      const angleProgress = index / count;
      const angle = angleProgress * TAU + (ring % 2) * 0.08;
      const orbitX = Math.cos(angle) * radius;
      const orbitY = Math.sin(angle) * radius * ellipseRatio;
      const size = 0.8 + ringProgress * 1.4 + Math.random() * 0.4;
      const length = 2.2 + ringProgress * 3.2 + Math.random() * 1.2;
      const depth = 0.3 + ringProgress * 0.95;
      const opacity = 0.25 + ringProgress * 0.45;

      dots.push({
        orbitX,
        orbitY,
        size,
        length,
        depth,
        opacity,
        seed: Math.random() * 1000,
        rotation: angle * 0.75 + (Math.random() - 0.5) * 0.5,
        color: colorForDot(ringProgress, angleProgress),
      });
    }
  }

  return { dots, maxRadius };
};

function InteractiveDotField({ className = '', density = 'medium', centerX = 0.5, centerY = 0.42 }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const sceneRef = useRef({ dots: [], maxRadius: 0, width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return undefined;
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      sceneRef.current = {
        ...buildDots(width, height, density),
        width,
        height,
        dpr,
      };
    };

    const setPointerFromEvent = (event) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      pointerRef.current.targetX = clamp(x, -1, 1);
      pointerRef.current.targetY = clamp(y, -1, 1);
    };

    const resetPointer = () => {
      pointerRef.current.targetX = 0;
      pointerRef.current.targetY = 0;
    };

    const render = (time) => {
      const { width, height, dots, maxRadius } = sceneRef.current;
      const pointer = pointerRef.current;
      pointer.x += (pointer.targetX - pointer.x) * 0.075;
      pointer.y += (pointer.targetY - pointer.y) * 0.075;

      context.clearRect(0, 0, width, height);

      const centerPxX = width * centerX + pointer.x * 12;
      const centerPxY = height * centerY + pointer.y * 10;
      const glow = context.createRadialGradient(centerPxX, centerPxY, 0, centerPxX, centerPxY, maxRadius * 0.95);
      glow.addColorStop(0, 'rgba(255,255,255,0.78)');
      glow.addColorStop(0.55, 'rgba(255,255,255,0.25)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      dots.forEach((dot) => {
        const wobbleX = Math.sin(time * 0.001 + dot.seed) * (0.4 + dot.depth * 1.1);
        const wobbleY = Math.cos(time * 0.0012 + dot.seed) * (0.35 + dot.depth * 0.85);
        const driftX = pointer.x * 24 * dot.depth;
        const driftY = pointer.y * 18 * dot.depth;
        const x = centerPxX + dot.orbitX + driftX + wobbleX;
        const y = centerPxY + dot.orbitY + driftY + wobbleY;
        const rotation = dot.rotation + pointer.x * 0.3 - pointer.y * 0.12;

        context.save();
        context.translate(x, y);
        context.rotate(rotation);
        context.fillStyle = rgba(dot.color, dot.opacity);
        context.beginPath();
        context.ellipse(0, 0, dot.size, dot.length, 0, 0, TAU);
        context.fill();
        context.restore();
      });

      animationRef.current = window.requestAnimationFrame(render);
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    window.addEventListener('pointermove', setPointerFromEvent);
    window.addEventListener('pointerleave', resetPointer);
    window.addEventListener('resize', resize);
    animationRef.current = window.requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', setPointerFromEvent);
      window.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationRef.current);
    };
  }, [centerX, centerY, density]);

  return (
    <div ref={containerRef} className={`interactive-dot-field ${className}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default InteractiveDotField;
