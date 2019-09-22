
export interface EventArgs {}
export type EventHandlerBase = (arg: EventArgs) => any;

export interface EventHandler<T> extends EventHandlerBase {
    (arg: T): any;
}

export class EventEmitter {
    handlers: { [event: string]: EventHandlerBase[] } = {};

    addHandler(event: string, handler: EventHandlerBase) {
        const handlers = this.handlers;
        handlers[event] = handlers[event] || [];
        handlers[event].push(handler);
    }

    removeHandler(event: string, handler: EventHandlerBase) {
        const allHandlers = this.handlers;
        const handlers = allHandlers[event];
        if (handlers && handler) {
            handlers.splice(handlers.indexOf(handler), 1);
        }
    }

    emit<TArgs extends EventArgs>(event: string, args: TArgs) {
        const handlers = this.handlers[event];
        if (handlers) {
           handlers.forEach(handler => handler(args));
        }
    }
}
