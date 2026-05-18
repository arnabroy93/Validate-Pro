import React from 'react';
import { motion } from 'motion/react';

export function Background() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-[#f0fdfa] to-[#ccfbf1]">
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      
      <motion.div
        animate={{
          x: ['-5%', '5%', '-5%'],
          y: ['-5%', '10%', '-5%'],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[10%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-brand-primary/10 mix-blend-multiply filter blur-[100px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: ['5%', '-5%', '5%'],
          y: ['10%', '-5%', '10%'],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vw] rounded-full bg-teal-300/20 mix-blend-multiply filter blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: ['-10%', '10%', '-10%'],
          y: ['10%', '-10%', '10%'],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[40%] right-[30%] w-[35vw] h-[35vw] rounded-full bg-emerald-200/20 mix-blend-multiply filter blur-[90px] pointer-events-none"
      />
    </div>
  );
}
