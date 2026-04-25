import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HostUser, HostListingsResponse, ListingSummary, getInitials } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

@Component({
  selector: 'app-host-profile',
  standalone: true,
  imports: [CommonModule, DisplayCardComponent, AvatarComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:600px;margin:0 auto;padding:0 20px">

        <!-- Header bar -->
        <div style="display:flex;align-items:center;padding:16px 0 8px;gap:12px">
          <button (click)="back.emit()"
                  style="width:36px;height:36px;border-radius:50%;background:white;border:1.5px solid #e2e8f0;
                         cursor:pointer;display:flex;align-items:center;justify-content:center;
                         box-shadow:0 1px 4px rgba(0,0,0,0.06);flex-shrink:0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <span style="font-weight:700;font-size:16px;color:#0f172a">Events</span>
        </div>

        <!-- Host profile card -->
        <div style="background:white;border-radius:16px;padding:24px;margin-bottom:20px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="display:flex;align-items:center;gap:16px">
            <!-- Avatar: photo if available, else initials -->
            <img *ngIf="host.avatarUrl"
                 [src]="host.avatarUrl"
                 [alt]="host.name"
                 style="width:60px;height:60px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
            <app-avatar *ngIf="!host.avatarUrl"
                        [initials]="getInitials(host.name)" [size]="60"/>
            <div>
              <div style="font-weight:800;font-size:19px;color:#0f172a">{{host.name}}</div>
              <div *ngIf="!loading()" style="font-size:13px;color:#64748b;margin-top:2px">
                {{listings().length}} upcoming event{{listings().length === 1 ? '' : 's'}}
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading()"
             style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
          Loading…
        </div>

        <!-- Error -->
        <div *ngIf="loadError()"
             style="padding:16px 20px;background:#fee2e2;border-radius:12px;margin-bottom:12px;
                    font-size:13.5px;color:#dc2626;font-weight:600">
          Could not load events. Try again.
          <button (click)="load()"
                  style="margin-left:12px;padding:4px 12px;border-radius:8px;font-size:12px;
                         font-weight:600;background:#dc2626;color:white;border:none;cursor:pointer">
            Retry
          </button>
        </div>

        <!-- Event list -->
        <ng-container *ngIf="!loading() && !loadError()">
          <div *ngIf="listings().length === 0"
               style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
            No upcoming events from this host
          </div>
          <app-display-card *ngFor="let d of listings()"
            [display]="d" [upvoted]="false" [showDetails]="false"
            (select)="viewDetails.emit(d)"
            (viewDetails)="viewDetails.emit(d)"/>
        </ng-container>

      </div>
    </div>
  `
})
export class HostProfileComponent implements OnInit {
  @Input() host!: HostUser;
  @Output() back = new EventEmitter<void>();
  @Output() viewDetails = new EventEmitter<ListingSummary>();

  loading = signal(true);
  loadError = signal(false);
  listings = signal<ListingSummary[]>([]);

  getInitials = getInitials;

  private listingApi = inject(ListingApiService);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    const request$ = this.host.handle
      ? this.listingApi.getHostListingsByHandle(this.host.handle)
      : this.listingApi.getHostListings(this.host.id);
    request$.subscribe({
      next: (data: HostListingsResponse) => {
        this.listings.set(data.listings);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }
}
