import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ToastStack } from '@/components/ui/ToastStack';
import { ThemeSync } from '@/components/ui/ThemeSync';
import { CapturePadController } from '@/components/capture/CapturePadController';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GregLite',
  description: 'Cognitive operating environment',
  icons: {
    icon: '/gregore-logo.png',
    shortcut: '/gregore-logo.png',
    apple: '/gregore-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeSync />
        {children}
        <ToastStack />
        <CapturePadController />
      </body>
    </html>
  );
}
