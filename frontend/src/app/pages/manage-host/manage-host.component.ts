import { Component, Input, Output, EventEmitter, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HostEntity, ListingSummary, HostListingsResponse, isExpired, getInitials } from '../../models/listing.model';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { HostService } from '../../services/host.service';
import { ListingApiService } from '../../services/listing-api.service';

@Component({
  selector: 'app-manage-host',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:600px;margin:0 auto;padding:0 20px">

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:12px;padding:16px 0 12px">
          <button (click)="back.emit()"
                  style="background:none;border:none;cursor:pointer;padding:6px;
                         color:#64748b;display:flex;align-items:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style="font-weight:800;font-size:20px;color:#0f172a;flex:1">{{host.displayName}}</div>
        </div>

        <!-- Host Settings -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:14px">Host Settings</div>

          <!-- Avatar -->
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
            <img *ngIf="host.avatarUrl" [src]="host.avatarUrl" [alt]="host.displayName"
                 style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
            <app-avatar *ngIf="!host.avatarUrl" [initials]="getInitials(host.displayName)" [size]="56"/>
            <div>
              <label style="font-size:12px;color:#64748b;font-weight:600;display:block;margin-bottom:4px">
                Avatar photo
              </label>
              <input type="file" accept="image/*" (change)="onAvatarChange($event)"
                     style="font-size:12px;color:#374151"/>
            </div>
          </div>

          <!-- Display name -->
          <div style="margin-bottom:10px">
            <label style="font-size:12.5px;font-weight:600;color:#374151;display:block;margin-bottom:5px">
              Display name
            </label>
            <input [ngModel]="editName()" (ngModelChange)="editName.set($event)"
                   style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;outline:none"/>
          </div>

          <!-- Handle -->
          <div style="margin-bottom:12px">
            <label style="font-size:12.5px;font-weight:600;color:#374151;display:block;margin-bottom:5px">
              Handle
            </label>
            <input [ngModel]="editHandle()" (ngModelChange)="editHandle.set($event)"
                   style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;outline:none"/>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">
              eventmapster.com/host/{{editHandle() || host.handle}}
            </div>
          </div>

          <div *ngIf="saveError()"
               style="font-size:12px;color:#ef4444;margin-bottom:8px">{{saveError()}}</div>

          <button (click)="saveHost()"
                  [disabled]="saving()"
                  [style.opacity]="saving() ? '0.6' : '1'"
                  style="padding:9px 20px;background:var(--accent);color:white;border:none;
                         border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">
            {{saving() ? 'Saving…' : saved() ? 'Saved!' : 'Save'}}
          </button>

          <!-- Transfer -->
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9">
            <div *ngIf="!showTransfer()">
              <button (click)="showTransfer.set(true)"
                      style="background:none;border:none;color:#0369a1;font-size:13px;
                             font-weight:600;cursor:pointer;padding:0">
                Transfer this host to another user
              </button>
            </div>
            <div *ngIf="showTransfer()">
              <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">
                Transfer "{{host.displayName}}" to another user
              </div>
              <input [ngModel]="transferHandle()" (ngModelChange)="transferHandle.set($event)"
                     placeholder="Recipient's handle"
                     style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                            font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                            outline:none;margin-bottom:8px"/>
              <div *ngIf="transferError()"
                   style="font-size:12px;color:#ef4444;margin-bottom:8px">{{transferError()}}</div>
              <div style="display:flex;gap:8px">
                <button (click)="doTransfer()"
                        [disabled]="transferring()"
                        [style.opacity]="transferring() ? '0.6' : '1'"
                        style="padding:8px 14px;background:#dc2626;color:white;border:none;
                               border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                  {{transferring() ? 'Transferring…' : 'Transfer'}}
                </button>
                <button (click)="showTransfer.set(false)"
                        style="padding:8px 12px;background:none;border:1.5px solid #e2e8f0;
                               border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <!-- Delete host -->
          <div style="margin-top:14px">
            <div *ngIf="!showDeleteHost()">
              <button (click)="showDeleteHost.set(true)"
                      style="background:none;border:none;color:#dc2626;font-size:13px;
                             font-weight:600;cursor:pointer;padding:0">
                Delete this host
              </button>
            </div>
            <div *ngIf="showDeleteHost()">
              <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:10px">
                Delete "{{host.displayName}}"? This cannot be undone.
              </div>
              <div style="display:flex;gap:8px">
                <button (click)="doDeleteHost()"
                        [disabled]="deletingHost()"
                        [style.opacity]="deletingHost() ? '0.6' : '1'"
                        style="padding:8px 14px;background:#dc2626;color:white;border:none;
                               border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                  {{deletingHost() ? 'Deleting…' : 'Yes, delete'}}
                </button>
                <button (click)="showDeleteHost.set(false)"
                        style="padding:8px 12px;background:none;border:1.5px solid #e2e8f0;
                               border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Listings section -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-weight:700;font-size:14px;color:#0f172a">Listings</div>
            <button (click)="addListing.emit(host)"
                    style="padding:6px 12px;background:var(--accent);color:white;border:none;
                           border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
              + Add Listing
            </button>
          </div>

          <div *ngIf="loadingListings()"
               style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px">Loading…</div>

          <!-- Current & Upcoming -->
          <div *ngIf="!loadingListings()">
            <div *ngIf="currentListings().length === 0 && pastListings().length === 0"
                 style="text-align:center;padding:16px 0;color:#94a3b8;font-size:13px">
              No listings yet. Add one to get started.
            </div>

            <div *ngFor="let l of currentListings()" style="margin-bottom:10px">
              <ng-container *ngTemplateOutlet="listingCard; context: { l: l, isPast: false }"/>
            </div>

            <!-- Past listings (collapsible) -->
            <div *ngIf="pastListings().length > 0" style="margin-top:8px">
              <button (click)="pastExpanded.set(!pastExpanded())"
                      style="display:flex;align-items:center;gap:8px;background:none;border:none;
                             cursor:pointer;color:#64748b;font-size:13px;font-weight:600;padding:6px 0">
                <svg [style.transform]="pastExpanded() ? 'rotate(90deg)' : 'rotate(0)'"
                     style="transition:transform 0.15s"
                     width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                Past listings
                <span style="background:#e2e8f0;color:#64748b;border-radius:12px;
                             padding:1px 8px;font-size:11.5px;font-weight:700">
                  {{pastListings().length}}
                </span>
              </button>
              <div *ngIf="pastExpanded()">
                <div *ngFor="let l of pastListings()" style="margin-bottom:10px">
                  <ng-container *ngTemplateOutlet="listingCard; context: { l: l, isPast: true }"/>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Listing card template -->
    <ng-template #listingCard let-l="l" let-isPast="isPast">
      <div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;color:#0f172a;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              {{l.title}}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">
              {{l.city}}, {{l.state}}
            </div>
            <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">
              {{formatDate(l.startDatetime)}} – {{formatDate(l.endDatetime)}}
            </div>
          </div>
          <span [style.background]="l.isActive ? '#dcfce7' : '#fee2e2'"
                [style.color]="l.isActive ? '#166534' : '#dc2626'"
                style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;
                       flex-shrink:0;white-space:nowrap">
            {{l.isActive ? 'Active' : 'Inactive'}}
          </span>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <!-- Edit (not shown for past) -->
          <button *ngIf="!isPast" (click)="editListing.emit(l)"
                  style="padding:5px 12px;background:#e0f2fe;border:none;color:#0369a1;
                         border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
            Edit
          </button>
          <!-- Deactivate/Reactivate (not shown for past) -->
          <button *ngIf="!isPast" (click)="toggleActive(l)"
                  [disabled]="togglingId() === l.id"
                  [style.opacity]="togglingId() === l.id ? '0.6' : '1'"
                  style="padding:5px 12px;background:#f0fdf4;border:none;color:#166534;
                         border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
            {{togglingId() === l.id ? '…' : l.isActive ? 'Deactivate' : 'Reactivate'}}
          </button>
          <!-- Delete -->
          <button *ngIf="confirmDeleteId() !== l.id" (click)="confirmDeleteId.set(l.id)"
                  style="padding:5px 12px;background:#fee2e2;border:none;color:#dc2626;
                         border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
            Delete
          </button>
          <!-- Delete confirmation -->
          <ng-container *ngIf="confirmDeleteId() === l.id">
            <span style="font-size:12px;color:#374151;align-self:center">Delete?</span>
            <button (click)="doDelete(l)"
                    [disabled]="deletingId() === l.id"
                    [style.opacity]="deletingId() === l.id ? '0.6' : '1'"
                    style="padding:5px 12px;background:#dc2626;color:white;border:none;
                           border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">
              {{deletingId() === l.id ? '…' : 'Yes'}}
            </button>
            <button (click)="confirmDeleteId.set(null)"
                    style="padding:5px 12px;background:none;border:1.5px solid #e2e8f0;
                           color:#64748b;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
              No
            </button>
          </ng-container>
        </div>
      </div>
    </ng-template>
  `
})
export class ManageHostComponent implements OnInit {
  @Input() host!: HostEntity;
  @Output() back = new EventEmitter<void>();
  @Output() addListing = new EventEmitter<HostEntity>();
  @Output() editListing = new EventEmitter<ListingSummary>();

  getInitials = getInitials;

  private hostService = inject(HostService);
  private listingApi = inject(ListingApiService);

  listings = signal<ListingSummary[]>([]);
  loadingListings = signal(true);
  pastExpanded = signal(false);

  currentListings = computed(() =>
    this.listings().filter(l => l.isActive || !isExpired(l))
  );

  pastListings = computed(() =>
    this.listings().filter(l => !l.isActive && isExpired(l))
  );

  // Host settings
  editName = signal('');
  editHandle = signal('');
  saving = signal(false);
  saved = signal(false);
  saveError = signal('');

  // Transfer
  showTransfer = signal(false);
  transferHandle = signal('');
  transferring = signal(false);
  transferError = signal('');

  // Delete host
  showDeleteHost = signal(false);
  deletingHost = signal(false);

  // Listing actions
  togglingId = signal<number | null>(null);
  confirmDeleteId = signal<number | null>(null);
  deletingId = signal<number | null>(null);

  ngOnInit() {
    this.editName.set(this.host.displayName);
    this.editHandle.set(this.host.handle);
    this.hostService.getHostManagedListings(this.host.id).subscribe({
      next: (resp: HostListingsResponse) => {
        this.listings.set(resp.listings);
        this.loadingListings.set(false);
      },
      error: () => this.loadingListings.set(false),
    });
  }

  saveHost() {
    const name = this.editName().trim();
    const handle = this.editHandle().trim().toLowerCase();
    if (!name) { this.saveError.set('Name is required.'); return; }
    if (!handle || handle.length < 3) { this.saveError.set('Handle must be at least 3 characters.'); return; }
    if (handle.length > 30) { this.saveError.set('Handle must be 30 characters or fewer.'); return; }
    if (!/^[a-z0-9-]+$/.test(handle)) {
      this.saveError.set('Handle may only contain lowercase letters, numbers, and hyphens.'); return;
    }
    this.saving.set(true);
    this.saveError.set('');
    this.hostService.updateHost(this.host.id, name, handle).subscribe({
      next: updated => {
        this.host = updated;
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
      },
    });
  }

  onAvatarChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.hostService.uploadHostAvatar(this.host.id, file).subscribe({
      next: updated => { this.host = updated; },
      error: () => this.saveError.set('Avatar upload failed.'),
    });
  }

  doTransfer() {
    const handle = this.transferHandle().trim().toLowerCase();
    if (!handle) { this.transferError.set('Enter the recipient\'s handle.'); return; }
    this.transferring.set(true);
    this.transferError.set('');
    this.hostService.transferHost(this.host.id, handle).subscribe({
      next: () => { this.back.emit(); },
      error: err => {
        this.transferring.set(false);
        this.transferError.set(
          err.status === 404 ? 'No user found with that handle.' :
          err.status === 400 ? 'You already own this host.' :
          'Something went wrong.'
        );
      },
    });
  }

  doDeleteHost() {
    this.deletingHost.set(true);
    this.hostService.deleteHost(this.host.id).subscribe({
      next: () => { this.back.emit(); },
      error: err => {
        this.deletingHost.set(false);
        this.showDeleteHost.set(false);
        if (err.status === 409) {
          this.saveError.set('Deactivate all active listings before deleting.');
        }
      },
    });
  }

  toggleActive(listing: ListingSummary) {
    this.togglingId.set(listing.id);
    this.listingApi.setListingActive(listing.id, !listing.isActive).subscribe({
      next: updated => {
        this.listings.update(list => list.map(l => l.id === updated.id ? updated : l));
        this.togglingId.set(null);
      },
      error: () => this.togglingId.set(null),
    });
  }

  doDelete(listing: ListingSummary) {
    this.deletingId.set(listing.id);
    this.listingApi.deleteListing(listing.id).subscribe({
      next: () => {
        this.listings.update(list => list.filter(l => l.id !== listing.id));
        this.confirmDeleteId.set(null);
        this.deletingId.set(null);
      },
      error: () => {
        this.confirmDeleteId.set(null);
        this.deletingId.set(null);
      },
    });
  }

  formatDate(dt: string): string {
    return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
