import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Listing, ListingSummary, HostUser, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange } from '../../models/listing.model';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { UpvoteButtonComponent } from '../upvote-button/upvote-button.component';
import { ListingApiService } from '../../services/listing-api.service';

@Component({
  selector: 'app-display-detail',
  standalone: true,
  imports: [CommonModule, TagBadgeComponent, UpvoteButtonComponent],
  template: `
    <div (click)="close.emit()"
         style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:2000;
                display:flex;align-items:flex-end;justify-content:center"
         [style.align-items]="isMobile ? 'flex-end' : 'center'">

      <div (click)="$event.stopPropagation()"
           [style.border-radius]="isMobile ? '20px 20px 0 0' : '20px'"
           [style.width]="isMobile ? '100%' : '520px'"
           [style.max-height]="isMobile ? '90vh' : '85vh'"
           style="background:white;overflow-y:auto;display:flex;flex-direction:column;
                  box-shadow:0 24px 64px rgba(0,0,0,0.2)">

        <!-- Loading state -->
        <div *ngIf="loading()" style="padding:60px;text-align:center;color:#94a3b8">
          Loading…
        </div>

        <ng-container *ngIf="!loading() && fullDisplay()">
          <!-- Photo area -->
          <div style="width:100%;height:220px;background:#eef1f6;flex-shrink:0;
                      display:flex;align-items:center;justify-content:center;
                      position:relative;overflow:hidden">
            <img *ngIf="primaryPhotoUrl"
                 [src]="primaryPhotoUrl!"
                 style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>
            <svg *ngIf="!primaryPhotoUrl" width="100%" height="100%"
                 style="position:absolute;inset:0" preserveAspectRatio="none">
              <defs>
                <pattern id="det-pat" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="24" stroke="#dde3ed" stroke-width="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#det-pat)"/>
            </svg>
            <span *ngIf="!primaryPhotoUrl"
                  style="position:relative;font-size:12px;color:#9aaabb;font-family:monospace">
              photo — {{fullDisplay()!.title}}
            </span>
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
            <!-- Header -->
            <div style="flex:1">
              <div style="font-weight:800;font-size:20px;color:#0f172a;line-height:1.2;margin-bottom:4px">
                {{fullDisplay()!.title}}
              </div>
              <div style="font-size:13px;color:#64748b;margin-bottom:4px">📍 {{fullDisplay()!.address}}</div>
              <div (click)="onViewHost()"
                   style="font-size:13px;color:var(--accent);cursor:pointer;font-weight:600;
                          display:inline-block">
                By {{fullDisplay()!.submittedByName}}
              </div>
            </div>

            <!-- Category badge + date range -->
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <span [style.background]="categoryColors[fullDisplay()!.category]?.bg"
                    [style.color]="categoryColors[fullDisplay()!.category]?.text"
                    style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px">
                {{categoryLabels[fullDisplay()!.category]}}
              </span>
              <span style="font-size:12px;color:#64748b">
                {{formatDateRange(fullDisplay()!.startDatetime, fullDisplay()!.endDatetime)}}
              </span>
            </div>

            <!-- Upvote + stats -->
            <div style="display:flex;align-items:center;gap:16px;padding:14px 0;
                        border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9">
              <app-upvote-button [count]="fullDisplay()!.upvoteCount" [upvoted]="upvoted"
                (toggled)="upvote.emit()"/>
              <div style="font-size:12.5px;color:#64748b">
                {{fullDisplay()!.photoCount}} photos
              </div>
            </div>

            <!-- Tags -->
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              <app-tag-badge *ngFor="let t of fullDisplay()!.tags" [tag]="t.name"/>
            </div>

            <!-- Description -->
            <p *ngIf="fullDisplay()!.description"
               style="font-size:14px;color:#374151;line-height:1.65;margin:0">
              {{fullDisplay()!.description}}
            </p>

            <!-- Cuisine type — Food Truck -->
            <div *ngIf="fullDisplay()!.cuisineType"
                 style="font-size:13.5px;color:#374151">
              🍽️ {{fullDisplay()!.cuisineType}}
            </div>

            <!-- Organizer — Estate Sale -->
            <div *ngIf="fullDisplay()!.organizer"
                 style="font-size:13.5px;color:#374151">
              🏢 {{fullDisplay()!.organizer}}
            </div>

            <!-- Price info -->
            <div *ngIf="fullDisplay()!.priceInfo"
                 style="font-size:13.5px;color:#374151">
              💰 {{fullDisplay()!.priceInfo}}
            </div>

            <!-- Best time — Christmas Lights -->
            <div *ngIf="fullDisplay()!.bestTime"
                 style="font-size:13.5px;color:#374151">
              🕐 {{fullDisplay()!.bestTime}}
            </div>

            <!-- Website -->
            <div *ngIf="fullDisplay()!.websiteUrl">
              <a [href]="fullDisplay()!.websiteUrl" target="_blank" rel="noopener"
                 style="font-size:13.5px;color:var(--accent);text-decoration:none;font-weight:600">
                🌐 Visit website
              </a>
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
        </ng-container>
      </div>
    </div>
  `
})
export class DisplayDetailComponent implements OnInit {
  @Input() summary!: ListingSummary;
  @Input() upvoted = false;
  @Input() isMobile = false;

  @Output() close = new EventEmitter<void>();
  @Output() upvote = new EventEmitter<void>();
  @Output() report = new EventEmitter<void>();
  @Output() viewHost = new EventEmitter<HostUser>();

  loading = signal(true);
  fullDisplay = signal<Listing | null>(null);

  private listingApi = inject(ListingApiService);

  categoryColors = CATEGORY_COLORS;
  categoryLabels = CATEGORY_LABELS;
  formatDateRange = formatDateRange;

  onViewHost() {
    const d = this.fullDisplay();
    if (!d) return;
    this.viewHost.emit({ id: d.submittedBy, name: d.submittedByName, displayName: d.submittedByDisplayName, avatarUrl: d.submittedByAvatarUrl });
  }

  ngOnInit() {
    this.listingApi.getById(this.summary.id).subscribe({
      next: listing => {
        this.fullDisplay.set(listing);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get primaryPhotoUrl(): string | null {
    const d = this.fullDisplay();
    if (!d?.photos?.length) return null;
    return d.photos.find(p => p.isPrimary)?.url ?? d.photos[0].url;
  }
}
