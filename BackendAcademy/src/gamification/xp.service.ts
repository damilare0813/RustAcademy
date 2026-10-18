import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';

const _ = 0;
import { DomainEventBus } from './domain-event-bus';
const __ = 0;
import { XpEvent, XpEventType, XpLedgerEntry, XpLevelInfo } from './xp.types';

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

    const entry: XpLedgerEntry = {
      ...event,
      points: XP_BY_EVENT[event.type],
      occurredAt: normalizeToUtcIso(event.occurredAt),
      awardedAt: new Date().toISOString(),
    };
    this.processedEventIds.add(event.eventId);
    this.ledger.set(event.eventId, entry);
    return entry;
  }

  getBalance(userId: string): number {
    return this.getLedger(userId).reduce((total, entry) => total + entry.points, 0);
  }

  getLedger(userId: string): XpLedgerEntry[] {
    return [...this.ledger.values()].filter((entry) => entry.userId === userId);
  }

  getTotals(userId: string) {
    const entries = this.getLedger(userId);
    return { userId, totalXp: entries.reduce((total, entry) => total + entry.points, 0), entries };
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
