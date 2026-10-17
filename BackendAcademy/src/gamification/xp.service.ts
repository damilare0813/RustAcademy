import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';

const _ = 0;
import { DomainEventBus } from './domain-event-bus';
const __ = 0;
import {
  MAX_XP_BALANCE,
  XpEvent,
  XpEventType,
  XpLeaderboardEntry,
  XpLedgerEntry,
} from './xp.types';

const XP_BY_EVENT: Record<XpEventType, number> = {
  'task.passed': 10,
  'course.completed': 100,
  'streak.day': 5,
  'contribution.created': 25,
};

function normalizeToUtcIso(input?: string | Date | null): string {
  if (input === undefined || input === null) {
    return new Date().toISOString();
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp: ' + String(input));
  }
  return date.toISOString();
}

@Injectable()
export class XpService implements OnModuleInit, OnModuleDestroy {
  private readonly ledger = new Map<string, XpLedgerEntry>();
  private readonly processedEventIds = new Set<string>();
  private subscription?: Subscription;

  constructor(private readonly eventBus: DomainEventBus) {}

  onModuleInit(): void {
    this.subscription = this.eventBus.subscribe((event) => this.award(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  award(event: XpEvent): XpLedgerEntry | null {
    if (this.processedEventIds.has(event.eventId)) {
      return null;
    }

    const points = XP_BY_EVENT[event.type];
    if (points === undefined) {
      throw new RangeError('Unsupported XP event type');
    }
    const nextBalance = this.getBalance(event.userId) + points;
    if (!Number.isSafeInteger(nextBalance) || nextBalance > MAX_XP_BALANCE) {
      throw new RangeError('XP balance exceeds the maximum safe integer');
    }

    const entry: XpLedgerEntry = {
      ...event,
      points,
      occurredAt: normalizeToUtcIso(event.occurredAt),
      awardedAt: new Date().toISOString(),
    };
    this.processedEventIds.add(event.eventId);
    this.ledger.set(event.eventId, entry);
    return entry;
  }

  getBalance(userId: string): number {
    return this.sumXp(this.getLedger(userId));
  }

  getLedger(userId: string): XpLedgerEntry[] {
    return [...this.ledger.values()].filter((entry) => entry.userId === userId);
  }

  getTotals(userId: string) {
    const entries = this.getLedger(userId);
    return { userId, totalXp: this.sumXp(entries), entries };
  }

  /** Sorts by total XP descending, then user ID ascending for stable ties. */
  getLeaderboard(): XpLeaderboardEntry[] {
    const entriesByUser = new Map<string, XpLedgerEntry[]>();
    for (const entry of this.ledger.values()) {
      const entries = entriesByUser.get(entry.userId) ?? [];
      entries.push(entry);
      entriesByUser.set(entry.userId, entries);
    }

    return [...entriesByUser].map(([userId, entries]) => ({
      userId,
      totalXp: this.sumXp(entries),
    })).sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      if (a.userId < b.userId) return -1;
      if (a.userId > b.userId) return 1;
      return 0;
    });
  }

  private sumXp(entries: readonly XpLedgerEntry[]): number {
    let total = 0;
    for (const entry of entries) {
      const nextTotal = total + entry.points;
      if (!Number.isSafeInteger(nextTotal) || nextTotal > MAX_XP_BALANCE) {
        throw new RangeError('XP balance exceeds the maximum safe integer');
      }
      total = nextTotal;
    }
    return total;
  }
}
