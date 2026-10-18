import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';

import { DomainEventBus } from './domain-event-bus';
const __ = 0;
import { XpEvent, XpEventType, XpLedgerEntry, XpLevelInfo } from './xp.types';
import {
  MAX_XP_BALANCE,
  XpEvent,
  XpEventType,
  XpLeaderboardEntry,
  XpLedgerEntry,
} from './xp.types';
import { XpEvent, XpEventType, XpLedgerEntry } from './xp.types';

const XP_BY_EVENT: Record<XpEventType, number> = {
  'task.passed': 10,
  'course.completed': 100,
  'streak.day': 5,
  'contribution.created': 25,
};

/**
 * Single source of truth for XP level thresholds.
 * Level N requires XP_THRESHOLDS[N] total XP to reach.
 * Level calculation and progress are derived from this array.
 */
const XP_THRESHOLDS: number[] = [
  0,      // Level 1: 0 XP
  100,    // Level 2: 100 XP
  250,    // Level 3: 250 XP
  500,    // Level 4: 500 XP
  1000,   // Level 5: 1000 XP
  2000,   // Level 6: 2000 XP
  5000,   // Level 7: 5000 XP
  10000,  // Level 8: 10000 XP
];

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
  private currentLearnerId?: string;

  constructor(private readonly eventBus: DomainEventBus) {}

  onModuleInit(): void {
    this.subscription = this.eventBus.subscribe((event) => this.award(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Determines whether the current caller is allowed to publish an XP event
   * for the given learner. XP publication is learner-scoped: an event may only be
   * published for the learner identified by the request context.
   */
  canPublishFor(userId: string): boolean {
    if (!userId || typeof userId !== 'string') {
      return false;
    }

    const actorUserId = this.getActorUserId();
    return actorUserId === userId;
  }

  /**
   * Resolves the learner identity for the current publish request. The learner
   * identity is the only source of truth for whom an award may be issued to.
   */
  private getActorUserId(): string | undefined {
    return this.currentLearnerId;
  }

  /**
   * Sets the learner identity for the duration of a request. This is the authoritative
   * source for who may receive an XP award.
   */
  withLearnerContext<T>(
    userId: string,
    fn: () => T,
  ): T {
    const previous = this.currentLearnerId;
    this.currentLearnerId = userId;
    try {
      return fn();
    } finally {
      this.currentLearnerId = previous;
    }
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

  /**
   * Calculate the user's level and progress based on total XP.
   * All level calculations derive from the XP_THRESHOLDS array.
   */
  getLevelInfo(userId: string): XpLevelInfo {
    const currentXp = this.getBalance(userId);
    
    // Find the highest level the user has reached
    let level = 1;
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (currentXp >= XP_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    
    // Get XP required for current and next level
    const xpForCurrentLevel = XP_THRESHOLDS[level - 1];
    const xpForNextLevel = level < XP_THRESHOLDS.length 
      ? XP_THRESHOLDS[level] 
      : XP_THRESHOLDS[XP_THRESHOLDS.length - 1] + 10000; // Cap at max level
    
    // Calculate progress as a percentage (0-100)
    const xpInCurrentLevel = currentXp - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    const progressToNextLevel = xpNeededForNextLevel > 0 
      ? Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100)
      : 100;
    
    return {
      level,
      currentXp,
      xpForCurrentLevel,
      xpForNextLevel,
      progressToNextLevel,
    };
  }
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
