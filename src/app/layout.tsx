import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'عين السوق | رادار وتحليل إعلانات المنافسين',
  description: 'رصد إعلانات المنافسين وتحليل ملفاتك وصفحاتك بأحدث نماذج الذكاء الاصطناعي',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#0b0f19] text-slate-100 antialiased min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
