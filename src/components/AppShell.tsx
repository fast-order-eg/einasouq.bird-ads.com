'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { MobileNavProvider } from '@/context/MobileNavContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen w-full bg-[#0b0f19] text-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <Navbar />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
