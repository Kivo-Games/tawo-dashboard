'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const steps = [
  { number: 1, label: 'Upload', href: '/' },
  { number: 2, label: 'Review', href: '/review' },
  { number: 3, label: 'Matching', href: '/matching' },
  { number: 4, label: 'Results', href: '/results-compact' },
];

export default function Header() {
  const pathname = usePathname();

  const getCurrentStep = () => {
    const step = steps.find((s) => s.href === pathname);
    return step?.number || 1;
  };

  const currentStep = getCurrentStep();

  return (
    <header className="sticky top-0 z-50 h-10 border-b border-gray-200 bg-gray-50">
      <div className="h-full px-3 flex items-center justify-between">
        {/* Left side - Logo and Steps */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            GAEB Matcher
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <nav className="hidden md:flex items-center gap-0.5">
            {steps.map((step) => (
              <Link
                key={step.number}
                href={step.href}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  step.number === currentStep
                    ? 'bg-gray-900 text-white'
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
