'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useLayoutEffect, useState } from 'react';

const steps = [
  { number: 1, label: 'Upload', href: '/' },
  { number: 2, label: 'Review', href: '/review' },
  { number: 3, label: 'Matching', href: '/matching' },
];

export default function Header() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Record<number, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const getCurrentStep = () => {
    const step = steps.find((s) => s.href === pathname);
    return step?.number ?? 1;
  };

  const currentStep = getCurrentStep();

  useLayoutEffect(() => {
    const nav = navRef.current;
    const activeLink = linkRefs.current[currentStep];
    if (!nav || !activeLink) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    setPill({
      left: linkRect.left - navRect.left,
      width: linkRect.width,
    });
  }, [currentStep, pathname]);

  return (
    <header className="sticky top-0 z-50 h-10 border-b border-gray-200 bg-gray-50">
      <div className="h-full px-3 flex items-center justify-between">
        {/* Left side - Logo and Steps */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            GAEB Matcher
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <nav
            ref={navRef}
            className="hidden md:flex items-center gap-0.5 relative"
          >
            {/* Sliding pill highlight */}
            <div
              className="absolute top-0 h-full rounded-full bg-gray-900 pointer-events-none transition-all duration-200 ease-out"
              style={{
                left: pill.left,
                width: pill.width,
              }}
            />
            {steps.map((step) => (
              <Link
                key={step.number}
                ref={(el) => {
                  linkRefs.current[step.number] = el;
                }}
                href={step.href}
                className={`relative z-10 px-2.5 py-1 text-xs rounded-full transition-colors ${
                  step.number === currentStep
                    ? 'text-white'
                    : step.number < currentStep
                    ? 'text-gray-700 hover:text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {step.number}. {step.label}
              </Link>
            ))}
          </nav>
        </div>

      </div>
    </header>
  );
}
