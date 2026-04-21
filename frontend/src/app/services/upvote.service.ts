import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UpvoteService {
  readonly upvotedIds = signal<Set<number>>(new Set([2, 4, 5]));

  isUpvoted(id: number): boolean {
    return this.upvotedIds().has(id);
  }

  toggle(id: number): boolean {
    const current = new Set(this.upvotedIds());
    if (current.has(id)) {
      current.delete(id);
      this.upvotedIds.set(current);
      return false;
    } else {
      current.add(id);
      this.upvotedIds.set(current);
      return true;
    }
  }

  getUpvotedIds(): Set<number> {
    return this.upvotedIds();
  }
}
