import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  // Absolute addresses in link previews (og:image and so on) start here
  metadataBase: new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: '家谱',
  description: 'Visualize and interact with complex family relationship structures',
  openGraph: { siteName: '家谱', title: '家谱' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
