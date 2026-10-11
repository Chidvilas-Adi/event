import { EventEmitter } from 'events';

class WorldEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  broadcast(eventType: string, data: any) {
    this.emit('world_event', { type: eventType, data, timestamp: Date.now() });
    this.emit(eventType, data);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __vc_event_bus: WorldEventBus | undefined;
}

export const eventBus: WorldEventBus =
  global.__vc_event_bus || new WorldEventBus();

if (process.env.NODE_ENV !== 'production') {
  global.__vc_event_bus = eventBus;
}
