import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upvote-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button (click)="handle($event)"
      [style.border]="'1.5px solid ' + (localUpvoted ? 'var(--accent)' : '#e5e7eb')"
      [style.background]="localUpvoted ? 'var(--accent-bg)' : 'white'"
      [style.color]="localUpvoted ? 'var(--accent-dark)' : '#6b7280'"
      [style.padding]="size === 'sm' ? '4px 10px' : '7px 14px'"
      [style.font-size]="size === 'sm' ? '12px' : '13px'"
      [style.opacity]="disabled ? '0.6' : '1'"
      [style.cursor]="disabled ? 'default' : 'pointer'"
      style="display:inline-flex;align-items:center;gap:5px;border-radius:99px;
             font-weight:700;transition:all 0.15s;">
      <svg [attr.width]="size === 'sm' ? 12 : 14" [attr.height]="size === 'sm' ? 12 : 14"
           viewBox="0 0 24 24"
           [attr.fill]="localUpvoted ? 'var(--accent)' : 'none'"
           [attr.stroke]="localUpvoted ? 'var(--accent)' : '#9ca3af'" stroke-width="2">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
      {{displayCount}}
    </button>
  `
})
export class UpvoteButtonComponent implements OnChanges {
  @Input() count = 0;
  @Input() upvoted = false;
  @Input() disabled = false;
  @Input() size: 'sm' | 'md' = 'md';
  @Output() toggled = new EventEmitter<void>();

  localCount = 0;
  localUpvoted = false;

  ngOnChanges() {
    this.localCount = this.count;
    this.localUpvoted = this.upvoted;
  }

  get displayCount() {
    return this.localCount >= 1000 ? (this.localCount / 1000).toFixed(1) + 'k' : this.localCount;
  }

  handle(e: Event) {
    e.stopPropagation();
    if (this.disabled) return;
    this.localUpvoted = !this.localUpvoted;
    this.localCount += this.localUpvoted ? 1 : -1;
    this.toggled.emit();
  }
}
