import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Display, TYPE_COLORS, TYPE_LABELS } from '../../models/display.model';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { UpvoteButtonComponent } from '../upvote-button/upvote-button.component';

@Component({
  selector: 'app-display-detail',
  standalone: true,
  imports: [CommonModule, TagBadgeComponent, UpvoteButtonComponent],
  template: `
    <!-- Backdrop -->
    <div (click)="close.emit()"
         style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:2000;
                display:flex;align-items:flex-end;justify-content:center"
         [style.align-items]="isMobile ? 'flex-end' : 'center'">

      <!-- Panel -->
      <div (click)="$event.stopPropagation()"
           [style.border-radius]="isMobile ? '20px 20px 0 0' : '20px'"
           [style.width]="isMobile ? '100%' : '520px'"
           [style.max-height]="isMobile ? '90vh' : '85vh'"
           style="background:white;overflow-y:auto;display:flex;flex-direction:column;
                  box-shadow:0 24px 64px rgba(0,0,0,0.2)">

        <!-- Photo area -->
        <div style="width:100%;height:220px;background:#eef1f6;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;
                    position:relative;overflow:hidden">
          <svg width="100%" height="100%" style="position:absolute;inset:0" preserveAspectRatio="none">
            <defs>
              <pattern id="det-pat" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="24" stroke="#dde3ed" stroke-width="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#det-pat)"/>
          </svg>
          <span style="position:relative;font-size:12px;color:#9aaabb;font-family:monospace">
            photo — {{display.title}}
          </span>
          <!-- Close button -->
          <button (click)="close.emit()"
                  style="position:absolute;top:12px;right:12px;width:32px;height:32px;
                         border-radius:50%;background:rgba(255,255,255,0.9);border:none;
                         cursor:pointer;display:flex;align-items:center;justify-content:center;
                         box-shadow:0 2px 8px rgba(0,0,0,0.15)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div style="padding:22px 24px 32px;display:flex;flex-direction:column;gap:16px">
          <!-- Header row -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1">
              <div style="font-weight:800;font-size:20px;color:#0f172a;line-height:1.2;margin-bottom:4px">
                {{display.title}}
              </div>
              <div style="font-size:13px;color:#64748b">📍 {{display.address}}</div>
            </div>
            <span [style.background]="typeColors.bg" [style.color]="typeColors.text"
                  style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;
                         white-space:nowrap;flex-shrink:0;margin-top:2px">
              {{typeLabel}}
            </span>
          </div>

          <!-- Upvote + stats -->
          <div style="display:flex;align-items:center;gap:16px;padding:14px 0;
                      border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9">
            <app-upvote-button [count]="display.upvote_count" [upvoted]="upvoted"
              (toggled)="upvote.emit()"/>
            <div style="font-size:12.5px;color:#64748b">
              {{display.photo_count}} photos · {{display.best_time}}
            </div>
          </div>

          <!-- Tags -->
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <app-tag-badge *ngFor="let t of display.tags" [tag]="t"/>
          </div>

          <!-- Description -->
          <p *ngIf="display.description" style="font-size:14px;color:#374151;line-height:1.65;margin:0">
            {{display.description}}
          </p>

          <!-- Best time -->
          <div style="background:#f8fafc;border-radius:10px;padding:14px 16px">
            <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                        letter-spacing:0.6px;margin-bottom:6px">Hours</div>
            <div style="font-size:13.5px;color:#374151">{{display.best_time}}</div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:10px;margin-top:4px">
            <button style="flex:1;padding:11px;border-radius:10px;font-size:13.5px;font-weight:600;
                           background:var(--accent);color:white;border:none;cursor:pointer">
              Get Directions
            </button>
            <button (click)="report.emit()"
                    style="padding:11px 14px;border-radius:10px;font-size:13.5px;font-weight:600;
                           background:none;border:1.5px solid #e2e8f0;color:#64748b;cursor:pointer">
              Report
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DisplayDetailComponent {
  @Input() display!: Display;
  @Input() upvoted = false;
  @Input() isMobile = false;

  @Output() close = new EventEmitter<void>();
  @Output() upvote = new EventEmitter<void>();
  @Output() report = new EventEmitter<void>();

  get typeColors() { return TYPE_COLORS[this.display.display_type]; }
  get typeLabel() { return TYPE_LABELS[this.display.display_type]; }
}
