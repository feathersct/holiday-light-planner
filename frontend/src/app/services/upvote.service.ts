import { Injectable, signal, inject } from '@angular/core';
import { ListingApiService } from './listing-api.service';

@Injectable({ providedIn: 'root' })
export class UpvoteService {
  private listingApi = inject(ListingApiService);
  readonly upvotedIds = signal<Set<number>>(new Set());

  isUpvoted(id: number): boolean {
    return this.upvotedIds().has(id);
  }

  initFromIds(ids: number[]): void {
    this.upvotedIds.set(new Set(ids));
  }

  toggle(id: number): void {
    const wasUpvoted = this.upvotedIds().has(id);
    const next = new Set(this.upvotedIds());
    if (wasUpvoted) {
      next.delete(id);
      this.upvotedIds.set(next);
      this.listingApi.removeUpvote(id).subscribe({
        error: () => {
          const rollback = new Set(this.upvotedIds());
          rollback.add(id);
          this.upvotedIds.set(rollback);
        }
      });
    } else {
      next.add(id);
      this.upvotedIds.set(next);
      this.listingApi.upvote(id).subscribe({
        error: () => {
          const rollback = new Set(this.upvotedIds());
          rollback.delete(id);
          this.upvotedIds.set(rollback);
        }
      });
    }
  }

  getUpvotedIds(): Set<number> {
    return this.upvotedIds();
  }
}
