import { Component, Input, Output, EventEmitter, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListingSummary, User, CATEGORY_COLORS, CATEGORY_LABELS, isExpired, formatDateRange, getInitials } from '../../models/listing.model';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { UpvoteService } from '../../services/upvote.service';
import { ListingApiService } from '../../services/listing-api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, DisplayCardComponent, AvatarComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:600px;margin:0 auto;padding:28px 20px 0">

        <!-- Profile card -->
        <div style="background:white;border-radius:16px;padding:24px;margin-bottom:20px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
            <app-avatar [initials]="user ? getInitials(user.name) : '?'" [size]="60"/>
            <div>
              <div style="font-weight:800;font-size:19px;color:#0f172a">{{user?.name || 'Guest'}}</div>
              <div style="font-size:13px;color:#64748b;margin-top:2px">{{user?.email || ''}}</div>
            </div>
          </div>
          <div style="display:flex;gap:24px">
            <div style="text-align:center">
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{myListings().length}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Listings</div>
            </div>
            <div style="text-align:center">
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{totalUpvotes()}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Upvotes received</div>
            </div>
            <div style="text-align:center">
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{upvotedListings().length}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Upvoted</div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;background:white;border-radius:12px;padding:4px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <button *ngFor="let t of tabs" (click)="setTab(t.id)"
                  [style.background]="activeTab() === t.id ? 'var(--accent)' : 'none'"
                  [style.color]="activeTab() === t.id ? 'white' : '#64748b'"
                  style="flex:1;border:none;padding:9px;border-radius:9px;font-size:13.5px;
                         font-weight:600;cursor:pointer;transition:all 0.15s">
            {{t.label}}
          </button>
        </div>

        <!-- Loading -->
        <div *ngIf="loadingMine() || loadingUpvoted()"
             style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
          Loading…
        </div>

        <!-- My Listings -->
        <div *ngIf="activeTab() === 'mine' && !loadingMine()">
          <div *ngIf="myListings().length === 0"
               style="text-align:center;padding:48px 0;color:#94a3b8">
            <div style="font-size:14px">You haven't submitted any listings yet</div>
          </div>
          <div *ngFor="let d of myListings()" [style.opacity]="isExpired(d) ? '0.55' : '1'" style="position:relative;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span [style.background]="categoryColors[d.category]?.bg"
                    [style.color]="categoryColors[d.category]?.text"
                    style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;display:inline-block">
                {{categoryLabels[d.category]}}
              </span>
              <span *ngIf="isExpired(d)"
                    style="font-size:10px;color:#ef4444;font-weight:700">Ended</span>
            </div>
            <app-display-card [display]="d"
              [upvoted]="upvoteService.isUpvoted(d.id)" [showDetails]="true"
              (select)="selectDisplay.emit(d)" (upvote)="upvoteService.toggle(d.id)"
              (viewDetails)="selectDisplay.emit(d)"/>

            <!-- Edit + Delete buttons -->
            <div *ngIf="deletingId() !== d.id"
                 style="position:absolute;top:12px;right:12px;display:flex;gap:6px">
              <button (click)="editListing.emit(d)"
                      style="background:#e0f2fe;border:none;color:#0369a1;border-radius:8px;
                             padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer">
                Edit
              </button>
              <button (click)="confirmDelete(d.id)"
                      style="background:#fee2e2;border:none;color:#dc2626;border-radius:8px;
                             padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer">
                Delete
              </button>
            </div>

            <!-- Inline confirmation -->
            <div *ngIf="deletingId() === d.id"
                 style="position:absolute;top:12px;right:12px;background:white;border-radius:10px;
                        padding:10px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.15);
                        display:flex;align-items:center;gap:10px;z-index:10">
              <span style="font-size:12.5px;color:#374151;font-weight:600">Delete this listing?</span>
              <button (click)="doDelete(d.id)"
                      style="background:#dc2626;color:white;border:none;border-radius:7px;
                             padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">
                Yes, delete
              </button>
              <button (click)="cancelDelete()"
                      style="background:none;border:1.5px solid #e2e8f0;border-radius:7px;
                             padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;color:#64748b">
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Upvoted -->
        <div *ngIf="activeTab() === 'upvoted' && !loadingUpvoted()">
          <div *ngIf="upvotedListings().length === 0"
               style="text-align:center;padding:48px 0;color:#94a3b8">
            <div style="font-size:14px">No upvoted listings yet</div>
          </div>
          <app-display-card *ngFor="let d of upvotedListings()" [display]="d"
            [upvoted]="true" [showDetails]="true"
            (select)="selectDisplay.emit(d)" (upvote)="upvoteService.toggle(d.id)"
            (viewDetails)="selectDisplay.emit(d)"/>
        </div>

      </div>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  @Input() user: User | null = null;
  @Output() selectDisplay = new EventEmitter<ListingSummary>();
  @Output() editListing = new EventEmitter<ListingSummary>();

  activeTab = signal<'mine' | 'upvoted'>('mine');
  myListings = signal<ListingSummary[]>([]);
  upvotedListings = signal<ListingSummary[]>([]);
  loadingMine = signal(true);
  loadingUpvoted = signal(true);

  tabs = [
    { id: 'mine', label: 'My Listings' },
    { id: 'upvoted', label: 'Upvoted' },
  ];

  getInitials = getInitials;
  categoryColors = CATEGORY_COLORS;
  categoryLabels = CATEGORY_LABELS;
  isExpired = isExpired;
  formatDateRange = formatDateRange;

  private listingApi = inject(ListingApiService);

  constructor(
    public upvoteService: UpvoteService,
  ) {}

  ngOnInit() {
    this.listingApi.getMyListings().subscribe({
      next: d => { this.myListings.set(d); this.loadingMine.set(false); },
      error: () => this.loadingMine.set(false),
    });
    this.listingApi.getUpvotedListings().subscribe({
      next: d => { this.upvotedListings.set(d); this.loadingUpvoted.set(false); },
      error: () => this.loadingUpvoted.set(false),
    });
  }

  setTab(id: string) {
    this.activeTab.set(id as 'mine' | 'upvoted');
  }

  totalUpvotes() {
    return this.myListings().reduce((sum, d) => sum + d.upvoteCount, 0);
  }

  deletingId = signal<number | null>(null);

  confirmDelete(id: number) {
    this.deletingId.set(id);
  }

  cancelDelete() {
    this.deletingId.set(null);
  }

  doDelete(id: number) {
    this.listingApi.deleteListing(id).subscribe({
      next: () => {
        this.myListings.update(list => list.filter(d => d.id !== id));
        this.deletingId.set(null);
      },
      error: () => this.deletingId.set(null),
    });
  }
}
