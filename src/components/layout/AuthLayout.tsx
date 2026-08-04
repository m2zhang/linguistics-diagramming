import { ReactNode } from 'react';
import { TreeLogo } from '../icons';

interface AuthLayoutProps {
  children: ReactNode;
}

function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <circle cx="10" cy="10" r="9" className="fill-white/15" />
      <path
        d="M6 10.2l2.6 2.6L14 7.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-bg">
      {/* Left Column - Premium Marketing Display (Hidden on mobile, 50% width on large screens) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-accent to-accent-strong flex-col justify-center px-16 xl:px-24 text-white">
        
        {/* Subtle animated background shapes for premium feel */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl mix-blend-overlay animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] rounded-full bg-white/10 blur-3xl mix-blend-overlay animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        
        {/* Glassmorphic floating diagram node (decorative) */}
        <div className="absolute right-16 top-1/4 w-32 h-16 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center transform rotate-6 animate-bounce" style={{ animationDuration: '6s' }}>
          <span className="font-mono text-sm tracking-wider font-semibold opacity-90">S</span>
        </div>
        <div className="absolute right-32 top-1/3 w-24 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center transform -rotate-12 animate-bounce" style={{ animationDuration: '7s', animationDelay: '1s' }}>
          <span className="font-mono text-sm tracking-wider font-semibold opacity-90">NP</span>
        </div>
        <div className="absolute right-8 top-[40%] w-20 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center transform rotate-3 animate-bounce" style={{ animationDuration: '5s', animationDelay: '2.5s' }}>
          <span className="font-mono text-sm tracking-wider font-semibold opacity-90">VP</span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-inner">
              <TreeLogo style={{ width: 32, height: 32, color: 'white' }} />
            </div>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">SyntaxTree</span>
          </div>
          
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[1.1] tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Syntax trees in seconds, not hours.
          </h1>

          <p className="text-lg leading-relaxed text-white/80 font-medium mb-8">
            Type bracket notation or drag a template — the branches lay themselves out. Annotate,
            highlight, and export to PNG, PDF, or LaTeX when the tree is right.
          </p>

          <ul className="flex flex-col gap-3 text-[15px] text-white/75">
            <li className="flex items-start gap-3">
              <Check />
              <span>
                <strong className="font-semibold text-white/95">Instructors</strong> build lesson
                trees, share them with a class code, and grade submissions in place.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check />
              <span>
                <strong className="font-semibold text-white/95">Students</strong> join with one
                code, diagram straight in the browser, and hand in without a single export.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[380px]">
          {children}
        </div>
      </div>
    </div>
  );
}
