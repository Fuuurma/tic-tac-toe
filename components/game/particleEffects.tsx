"use client";

import React, { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface ParticleEffectsProps {
  isActive: boolean;
  originX?: number;
  originY?: number;
  particleCount?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#fbbf24", // amber-400
  "#f59e0b", // amber-500
  "#fcd34d", // amber-300
  "#f472b6", // pink-400
  "#a78bfa", // violet-400
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#f87171", // red-400
];

export const ParticleEffects: React.FC<ParticleEffectsProps> = ({
  isActive,
  originX = 0.5,
  originY = 0.5,
  particleCount = 50,
  colors = DEFAULT_COLORS,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isActive || prefersReducedMotion) {
      setParticles([]);
      return;
    }

    // Create particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const velocity = 1.4 + Math.random() * 2.6;
      
      newParticles.push({
        id: i,
        x: originX * 100,
        y: originY * 100,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 4,
        life: 1,
        maxLife: 45 + Math.random() * 25,
      });
    }

    setParticles(newParticles);

    // Animate particles
    let animationId: number;
    let frameCount = 0;

    const animate = () => {
      frameCount++;
      
      // Update particles every 2nd frame for performance
      if (frameCount % 2 === 0) {
        setParticles((prev) =>
          prev
            .map((p) => ({
              ...p,
              x: p.x + p.vx * 0.5,
              y: p.y + p.vy * 0.5,
              vy: p.vy + 0.15, // Gravity
              life: p.life - 1 / p.maxLife,
            }))
            .filter((p) => p.life > 0)
        );
      }

      if (frameCount < 150) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, prefersReducedMotion, originX, originY, particleCount, colors]);

  if (!isActive || particles.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-40"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.life,
            transform: `translate(-50%, -50%) scale(${particle.life})`,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            transition: "none",
          }}
        />
      ))}
    </div>
  );
};

export default ParticleEffects;
