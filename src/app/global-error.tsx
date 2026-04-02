'use client';

export default function GlobalError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 return (
 <html lang="es">
 <body>
 <div className="flex min-h-screen flex-col items-center justify-center">
 <h1 className="text-4xl font-bold">Something went wrong</h1>
 <p className="mt-4 text-muted-foreground">
 An unexpected error occurred. Please try again.
 </p>
 <button
 onClick={reset}
 className="mt-8 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
 >
 Try Again
 </button>
 </div>
 </body>
 </html>
 );
}
