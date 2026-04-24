import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange, formatTimeRange } from '../../models/listing.model';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { UpvoteButtonComponent } from '../upvote-button/upvote-button.component';

@Component({
  selector: 'app-display-card',
  standalone: true,
  imports: [CommonModule, TagBadgeComponent, UpvoteButtonComponent],
  template: `
    <div (click)="select.emit(display)"
         [style.border]="'1.5px solid ' + (isSelected ? 'var(--accent)' : '#e5e7eb')"
         [style.box-shadow]="isSelected ? '0 4px 20px var(--accent-shadow)' : '0 1px 4px rgba(0,0,0,0.05)'"
         style="background:white;border-radius:12px;overflow:hidden;cursor:pointer;
                transition:all 0.15s;margin-bottom:10px;flex-shrink:0;">
      <!-- Photo -->
      <div style="width:100%;height:130px;background:#eef1f6;display:flex;align-items:center;
                  justify-content:center;position:relative;overflow:hidden;">
        <img *ngIf="display.primaryPhotoUrl" [src]="display.primaryPhotoUrl"
             style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>
        <svg *ngIf="!display.primaryPhotoUrl" width="100%" height="100%"
             style="position:absolute;inset:0" preserveAspectRatio="none">
          <defs>
            <pattern [id]="'pat-'+display.id" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="24" stroke="#dde3ed" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" [attr.fill]="'url(#pat-' + display.id + ')'"/>
        </svg>
        <span *ngIf="!display.primaryPhotoUrl"
              style="position:relative;font-size:11px;color:#9aaabb;font-family:monospace;text-align:center;padding:0 12px;line-height:1.4">
          photo — {{display.title}}
        </span>
      </div>
      <div style="padding:11px 13px 13px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px">
          <div style="font-weight:700;font-size:13.5px;color:#111827;line-height:1.3;flex:1;margin-right:8px">{{display.title}}</div>
          <span [style.background]="typeColors.bg" [style.color]="typeColors.text"
                style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap;flex-shrink:0">
            {{typeLabel}}
          </span>
        </div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px">📍 {{display.city}}, {{display.state}}</div>
        <div [style.margin-bottom]="timeRange ? '2px' : '8px'"
             style="font-size:11.5px;color:#9ca3af">📅 {{dateRange}}</div>
        <div *ngIf="timeRange"
             style="font-size:11.5px;color:#9ca3af;margin-bottom:8px">🕐 {{timeRange}}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
          <app-tag-badge *ngFor="let t of display.tags.slice(0,3)" [tag]="t.name" [small]="true"/>
          <span *ngIf="display.tags.length > 3" style="font-size:10px;color:#9ca3af;align-self:center">+{{display.tags.length - 3}}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <app-upvote-button [count]="display.upvoteCount" [upvoted]="upvoted" size="sm"
            (toggled)="upvote.emit()"/>
          <button *ngIf="showDetails" (click)="viewDetails.emit(display); $event.stopPropagation()"
                  style="background:none;border:none;color:var(--accent-dark);font-size:12px;
                         font-weight:600;cursor:pointer;padding:4px 0">
            Details →
          </button>
        </div>
      </div>
    </div>
  `
})
export class DisplayCardComponent {
  @Input() display!: ListingSummary;
  @Input() isSelected = false;
  @Input() upvoted = false;
  @Input() showDetails = true;

  @Output() select = new EventEmitter<ListingSummary>();
  @Output() viewDetails = new EventEmitter<ListingSummary>();
  @Output() upvote = new EventEmitter<void>();

  get typeColors() { return CATEGORY_COLORS[this.display.category] ?? CATEGORY_COLORS['CHRISTMAS_LIGHTS']; }
  get typeLabel() { return CATEGORY_LABELS[this.display.category] ?? this.display.category; }
  get dateRange() { return formatDateRange(this.display.startDatetime, this.display.endDatetime); }
  get timeRange() { return formatTimeRange(this.display.startDatetime, this.display.endDatetime); }
}
