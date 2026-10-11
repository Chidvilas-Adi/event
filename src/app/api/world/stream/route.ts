import { eventBus } from '@/lib/events/bus';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Send initial connection packet
      const initialWorld = await pool.query('SELECT * FROM world_state WHERE id = $1', ['default']);
      if (initialWorld.rows.length > 0) {
        const w = initialWorld.rows[0];
        let effectiveClock = w.clock_seconds;
        if (!w.is_paused && !w.is_frozen && w.updated_at) {
          const elapsed = Math.floor((Date.now() - new Date(w.updated_at).getTime()) / 1000);
          if (elapsed > 0) effectiveClock += elapsed;
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'INIT_STATE',
              data: {
                clockSeconds: effectiveClock,
                currentTick: w.current_tick,
                isPaused: w.is_paused,
                isFrozen: w.is_frozen,
                freezeReason: w.freeze_reason,
                versionLabel: w.version_label,
                stateHash: w.state_hash,
              },
            })}\n\n`
          )
        );
      }

      // 2. Listen to world events
      const onWorldEvent = (event: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      eventBus.on('world_event', onWorldEvent);

      // 3. Heartbeat interval every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Clean up when request is aborted
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        eventBus.off('world_event', onWorldEvent);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
