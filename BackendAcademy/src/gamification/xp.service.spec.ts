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
  it('applies distinct valid events normally', () => {
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

    service.onModuleDestroy();
  });

  it('normalizes an event time with a non-UTC offset to UTC', () => {
    const bus = new DomainEventBus();
    const service = new XpService(bus);
    service.onModuleInit();

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
  it('ignores replayed event IDs but still applies new ones', () => {
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

    service.onModuleDestroy();
  });

  it('defaults a missing event time to a UTC timestamp', () => {
    const bus = new DomainEventBus();
    const service = new XpService(bus);
    service.onModuleInit();

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
        controller.publish({ eventId: `evt-${type}`, userId: 'user-1', type, amount }, { user: { id: 'user-1' } }),
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
        controller.publish({ eventId: 'evt-invalid', userId: 'user-1', type, amount }, { user: { id: 'user-1' } }),
      ).toThrow(BadRequestException);
      expect(service.getBalance('user-1')).toBe(0);
    });

    it('prevents a learner from publishing an award for another learner', () => {
      expect(() =>
        controller.publish(
          { eventId: 'evt-cross-user', userId: 'user-2', type: 'task.passed' },
          { user: { id: 'user-1' } },
        ),
      ).toThrow(BadRequestException);
      expect(service.getBalance('user-2')).toBe(0);
      expect(service.getBalance('user-1')).toBe(0);
    });

    it('prevents a learner from reading another learner\'s totals', () => {
      expect(() => controller.getTotals('user-2', { user: { id: 'user-1' } })).toThrow(
        BadRequestException,
      );
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

  describe('XP level calculation from thresholds', () => {
    let bus: DomainEventBus;
    let service: XpService;

    beforeEach(() => {
      bus = new DomainEventBus();
      service = new XpService(bus);
      service.onModuleInit();
    });

    afterEach(() => service.onModuleDestroy());

    function awardXp(userId: string, amount: number) {
      const eventCount = Math.ceil(amount / 10);
      for (let i = 0; i < eventCount; i++) {
        bus.publish({ 
          eventId: `evt-${userId}-${i}`, 
          userId, 
          type: 'task.passed' 
        });
      }
    }

    it('starts at level 1 with 0 XP', () => {
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(1);
      expect(info.currentXp).toBe(0);
      expect(info.xpForCurrentLevel).toBe(0);
      expect(info.xpForNextLevel).toBe(100);
      expect(info.progressToNextLevel).toBe(0);
    });

    it('calculates level 1 progress correctly', () => {
      awardXp('user-1', 5); // 50 XP
      
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(1);
      expect(info.currentXp).toBe(50);
      expect(info.progressToNextLevel).toBe(50);
    });

    it('reaches level 2 at exactly 100 XP', () => {
      awardXp('user-1', 10); // 100 XP
      
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(2);
      expect(info.currentXp).toBe(100);
      expect(info.xpForCurrentLevel).toBe(100);
      expect(info.xpForNextLevel).toBe(250);
      expect(info.progressToNextLevel).toBe(0);
    });

    it('calculates level 2 progress correctly', () => {
      awardXp('user-1', 17); // 170 XP
      
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(2);
      expect(info.currentXp).toBe(170);
      expect(info.xpForCurrentLevel).toBe(100);
      expect(info.xpForNextLevel).toBe(250);
      // Progress: (170 - 100) / (250 - 100) = 70 / 150 ≈ 46.67%
      expect(info.progressToNextLevel).toBeCloseTo(46.67, 1);
    });

    it('reaches level 3 at exactly 250 XP', () => {
      awardXp('user-1', 25); // 250 XP
      
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(3);
      expect(info.currentXp).toBe(250);
      expect(info.xpForCurrentLevel).toBe(250);
      expect(info.xpForNextLevel).toBe(500);
    });

    it.each([
      [1, 0, 99, 0, 100],
      [2, 100, 249, 100, 250],
      [3, 250, 499, 250, 500],
      [4, 500, 999, 500, 1000],
      [5, 1000, 1999, 1000, 2000],
      [6, 2000, 4999, 2000, 5000],
      [7, 5000, 9999, 5000, 10000],
    ] as const)(
      'level %i boundaries: XP range [%i, %i], thresholds [%i, %i]',
      (level, minXp, maxXp, currentThreshold, nextThreshold) => {
        // Test at minimum boundary
        awardXp('user-min', minXp / 10);
        const minInfo = service.getLevelInfo('user-min');
        expect(minInfo.level).toBe(level);
        expect(minInfo.xpForCurrentLevel).toBe(currentThreshold);
        expect(minInfo.xpForNextLevel).toBe(nextThreshold);
        
        // Test at maximum boundary (just before next level)
        awardXp('user-max', maxXp / 10);
        const maxInfo = service.getLevelInfo('user-max');
        expect(maxInfo.level).toBe(level);
        expect(maxInfo.xpForCurrentLevel).toBe(currentThreshold);
        expect(maxInfo.xpForNextLevel).toBe(nextThreshold);
      },
    );

    it('reaches max level 8 at 10000 XP', () => {
      awardXp('user-1', 1000); // 10000 XP
      
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(8);
      expect(info.currentXp).toBe(10000);
      expect(info.xpForCurrentLevel).toBe(10000);
      expect(info.progressToNextLevel).toBe(0);
    });

    it('caps progress at 100% when at max level', () => {
      awardXp('user-1', 1500); // 15000 XP (beyond max level)
      
      const info = service.getLevelInfo('user-1');
      
      expect(info.level).toBe(8);
      expect(info.currentXp).toBe(15000);
      expect(info.progressToNextLevel).toBe(100);
    });
  });
});
});
