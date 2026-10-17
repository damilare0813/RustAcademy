import { BadRequestException } from '@nestjs/common';
import { DomainEventBus } from './domain-event-bus';
import { XpController, XP_HISTORY_DEFAULT_LIMIT, XP_HISTORY_MAX_LIMIT } from './xp.controller';
import { PublishXpEventDto, XP_EVENT_SOURCES } from './dto/publish-xp-event.dto';
import { XpService } from './xp.service';
import { MAX_XP_BALANCE, XpLedgerEntry } from './xp.types';

describe('XpService', () => {
  it('awards an event once when the event is replayed', () => {
    const bus = new DomainEventBus();
    const service = new XpService(bus);
    service.onModuleInit();

    const event = { eventId: 'evt-1', userId: 'user-1', type: 'task.passed' as const };
    bus.publish(event);
    bus.publish(event);

    expect(service.getBalance('user-1')).toBe(10);
    expect(service.getLedger('user-1')).toHaveLength(1);
    expect(service.getTotals('user-1').totalXp).toBe(10);

    service.onModuleDestroy();
  });

  it('normalizes an event time with a non-UTC offset to UTC', () => {
    const bus = new DomainEventBus();
    const service = new XpService(bus);
    service.onModuleInit();

    bus.publish({ eventId: 'evt-1', userId: 'user-1', type: 'task.passed' });
    bus.publish({ eventId: 'evt-2', userId: 'user-1', type: 'task.passed' });
    bus.publish({ eventId: 'evt-3', userId: 'user-2', type: 'task.passed' });

    expect(service.getBalance('user-1')).toBe(20);
    expect(service.getLedger('user-1')).toHaveLength(2);
    expect(service.getBalance('user-2')).toBe(10);
    expect(service.getLedger('user-2')).toHaveLength(1);
    bus.publish({
      eventId: 'evt-offset',
      userId: 'user-offset',
      type: 'task.passed',
      occurredAt: '2024-01-15T10:30:00+02:00',
    });

    const [award] = service.getLedger('user-offset');
    expect(award.occurredAt).toBe('2024-01-15T08:30:00.000Z');

    service.onModuleDestroy();
  });

  it('defaults a missing event time to a UTC timestamp', () => {
    const bus = new DomainEventBus();
    const service = new XpService(bus);
    service.onModuleInit();

    bus.publish({ eventId: 'evt-1', userId: 'user-1', type: 'task.passed' });
    bus.publish({ eventId: 'evt-1', userId: 'user-1', type: 'task.passed' });
    bus.publish({ eventId: 'evt-2', userId: 'user-1', type: 'task.passed' });
    bus.publish({ eventId: 'evt-2', userId: 'user-1', type: 'task.passed' });

    expect(service.getBalance('user-1')).toBe(20);
    expect(service.getLedger('user-1')).toHaveLength(2);
    expect(service.getTotals('user-1').totalXp).toBe(20);

    bus.publish({ eventId: 'evt-default', userId: 'user-default', type: 'task.passed' });

    const [award] = service.getLedger('user-default');
    expect(award.occurredAt).match(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/);
    expect(award.occurredAt).toBe(new Date(award.occurredAt).toISOString());

    service.onModuleDestroy();
  });

  it('orders leaderboard ties by user ID ascending', () => {
    const bus = new DomainEventBus();
    const service = new XpService(bus);
    service.onModuleInit();

    bus.publish({ eventId: 'evt-z', userId: 'user-z', type: 'task.passed' });
    bus.publish({ eventId: 'evt-a', userId: 'user-a', type: 'task.passed' });

    expect(service.getLeaderboard()).toEqual([
      { userId: 'user-a', totalXp: 10 },
      { userId: 'user-z', totalXp: 10 },
    ]);

    service.onModuleDestroy();
  });

  it('rejects an award that would exceed the maximum safe XP balance', () => {
    const service = new XpService(new DomainEventBus());
    const ledger = Reflect.get(service, 'ledger') as Map<string, XpLedgerEntry>;
    ledger.set('seed', {
      eventId: 'seed',
      userId: 'user-1',
      type: 'course.completed',
      points: MAX_XP_BALANCE - 5,
      occurredAt: '2026-01-01T00:00:00.000Z',
      awardedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(() =>
      service.award({ eventId: 'overflow', userId: 'user-1', type: 'task.passed' }),
    ).toThrow(RangeError);
    expect(service.getLedger('user-1')).toHaveLength(1);
    expect(service.getBalance('user-1')).toBe(MAX_XP_BALANCE - 5);
  });

  it('rejects unsafe totals when reading the ledger', () => {
    const service = new XpService(new DomainEventBus());
    const ledger = Reflect.get(service, 'ledger') as Map<string, XpLedgerEntry>;
    const entry = {
      eventId: 'seed',
      userId: 'user-1',
      type: 'course.completed' as const,
      occurredAt: '2026-01-01T00:00:00.000Z',
      awardedAt: '2026-01-01T00:00:00.000Z',
    };
    ledger.set('first', { ...entry, points: MAX_XP_BALANCE });
    ledger.set('second', { ...entry, eventId: 'second', points: 1 });

    expect(() => service.getTotals('user-1')).toThrow(RangeError);
  });

  describe('XP award amount validation', () => {
    let bus: DomainEventBus;
    let service: XpService;
    let controller: XpController;

    beforeEach(() => {
      bus = new DomainEventBus();
      service = new XpService(bus);
      service.onModuleInit();
      controller = new XpController(bus, service);
    });

    afterEach(() => service.onModuleDestroy());

    it.each([
      ['streak.day', 5],
      ['task.passed', 10],
      ['contribution.created', 25],
      ['course.completed', 100],
    ] as const)('accepts configured award %s = %i XP', (type, amount) => {
      expect(
        controller.publish({ eventId: `evt-${type}`, userId: 'user-1', type, source: type, amount }),
      ).toMatchObject({ accepted: true });
      expect(service.getBalance('user-1')).toBe(amount);
    });

    it.each([
      ['negative amount', 'task.passed', -1],
      ['above policy maximum', 'course.completed', 101],
      ['fractional amount', 'task.passed', 10.5],
      ['amount that conflicts with event policy', 'streak.day', 10],
    ] as const)('rejects %s', (_description, type, amount) => {
      expect(() =>
        controller.publish({ eventId: 'evt-invalid', userId: 'user-1', type, source: type, amount }),
      ).toThrow(BadRequestException);
      expect(service.getBalance('user-1')).toBe(0);
    });
  });

  describe('XP event source validation', () => {
    let bus: DomainEventBus;
    let service: XpService;
    let controller: XpController;

    beforeEach(() => {
      bus = new DomainEventBus();
      service = new XpService(bus);
      service.onModuleInit();
      controller = new XpController(bus, service);
    });

    afterEach(() => service.onModuleDestroy());

    it.each(XP_EVENT_SOURCES)('accepts source %s and records it in event metadata', (source) => {
      controller.publish({
        eventId: `evt-${source}`,
        userId: 'user-1',
        type: source,
        source,
      });

      expect(service.getLedger('user-1')[0].metadata).toEqual({ source });
    });

    it.each([
      ['missing', undefined],
      ['unsupported', 'unknown'],
    ])('rejects a %s event source before publishing', (_description, source) => {
      const event = {
        eventId: 'evt-invalid-source',
        userId: 'user-1',
        type: 'task.passed',
        source,
      } as PublishXpEventDto;

      expect(() => controller.publish(event)).toThrow(BadRequestException);
      expect(service.getBalance('user-1')).toBe(0);
    });
  });

  describe('XP history queries', () => {
    let bus: DomainEventBus;
    let service: XpService;
    let controller: XpController;

    beforeEach(() => {
      bus = new DomainEventBus();
      service = new XpService(bus);
      service.onModuleInit();
      controller = new XpController(bus, service);
    });

    afterEach(() => service.onModuleDestroy());

    function seed(count: number) {
      for (let i = 0; i < count; i++) {
        bus.publish({ eventId: `evt-${i}`, userId: 'user-1', type: 'task.passed' });
      }
    }

    it('defaults to a bounded result size', () => {
      seed(XP_HISTORY_DEFAULT_LIMIT + 5);

      const result = controller.getHistory('user-1', {});

      expect(result.items).toHaveLength(XP_HISTORY_DEFAULT_LIMIT);
      expect(result.limit).toBe(XP_HISTORY_DEFAULT_LIMIT);
      expect(result.nextCursor).toBe(String(XP_HISTORY_DEFAULT_LIMIT));
    });

    it('honors a valid limit', () => {
      seed(10);

      const result = controller.getHistory('user-1', { limit: '3' });

      expect(result.items).toHaveLength(3);
      expect(result.limit).toBe(3);
      expect(result.nextCursor).toBe('3');
    });

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['fractional', 2.5],
      ['above the maximum', XP_HISTORY_MAX_LIMIT + 1],
      ['not a number', 'abc'],
    ] as const)('rejects an invalid limit (%s)', (_description, limit) => {
      expect(() => controller.getHistory('user-1', { limit })).toThrow(BadRequestException);
    });

    it.each([
      ['negative', '-1'],
      ['fractional', '1.5'],
      ['non-numeric', 'cursor'],
    ] as const)('rejects an invalid cursor (%s)', (_description, cursor) => {
      expect(() => controller.getHistory('user-1', { cursor })).toThrow(BadRequestException);
    });

    it('paginates with a stable cursor without duplicates or gaps', () => {
      seed(7);

      const first = controller.getHistory('user-1', { limit: 3 });
      expect(first.items).toHaveLength(3);
      expect(first.nextCursor).toBe('3');

      const second = controller.getHistory('user-1', { limit: 3, cursor: first.nextCursor });
      expect(second.items).toHaveLength(3);
      expect(second.nextCursor).toBe('6');

      const third = controller.getHistory('user-1', { limit: 3, cursor: second.nextCursor });
      expect(third.items).toHaveLength(1);
      expect(third.nextCursor).toBeNull();

      const ids = [...first.items, ...second.items, ...third.items].map(
        (item) => (item as { eventId: string }).eventId,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(7);
    });

    it('returns an empty page with a null cursor when the ledge is empty', () => {
      const result = controller.getHistory('user-1', {});

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });
  });
});
