import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '../config/wagmi';
import { ToastProvider } from '../components/Toast';
import Layout from '../components/Layout';
import { ThemeProvider } from '../contexts/ThemeContext';



// Create a client for React Query
const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>GBV Reporting Platform</title>
        <meta name="description" content="Secure, anonymous gender-based violence reporting platform powered by blockchain technology" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <Layout>
                <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 transition-colors duration-normal">
                  <Component {...pageProps} />
                </div>
              </Layout>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </>
  );
}