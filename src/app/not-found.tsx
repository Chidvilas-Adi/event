import Link from 'next/link';
import { Wordmark } from '@/components/ui/wordmark';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-md bg-vc-card border border-vc-border p-8 rounded-xl shadow-2xl space-y-6">
        <Wordmark size="md" className="mx-auto" />
        <div className="space-y-2">
          <div className="text-4xl font-syne font-black text-vc-gold">404</div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">
            Sector Coordinates Not Found
          </h2>
          <p className="text-xs text-gray-400">
            The requested city protocol, dossier, or terminal endpoint does not exist or has been decommissioned by the Game Master.
          </p>
        </div>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs rounded uppercase tracking-wider transition-all"
          >
            Return to City Gates
          </Link>
        </div>
      </div>
    </div>
  );
}
