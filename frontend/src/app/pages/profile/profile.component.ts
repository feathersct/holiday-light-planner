import { Component, Input, Output, EventEmitter, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListingSummary, User, HostEntity, CATEGORY_COLORS, CATEGORY_LABELS, isExpired, formatDateRange, getInitials } from '../../models/listing.model';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { UpvoteService } from '../../services/upvote.service';
import { ListingApiService } from '../../services/listing-api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, DisplayCardComponent, AvatarComponent],
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

        <!-- Display name setting -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">
            Business / host name
          </div>
          <div style="font-size:12.5px;color:#64748b;margin-bottom:12px">
            Shown on your listings instead of your Facebook name.
          </div>
          <div style="display:flex;gap:8px">
            <input [ngModel]="displayName()"
                   (ngModelChange)="displayName.set($event)"
                   placeholder="e.g. Joe's BBQ Truck"
                   style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;outline:none;background:white"/>
            <button (click)="saveDisplayName()"
                    [disabled]="savingDisplayName()"
                    [style.opacity]="savingDisplayName() ? '0.6' : '1'"
                    style="padding:9px 16px;background:var(--accent);color:white;border:none;
                           border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">
              {{savingDisplayName() ? 'Saving…' : displayNameSaved() ? 'Saved!' : 'Save'}}
            </button>
          </div>
        </div>

        <!-- Handle / profile URL -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">
            Profile URL handle
          </div>
          <div style="font-size:12.5px;color:#64748b;margin-bottom:12px">
            Share <strong style="color:#0f172a">eventmapster.com/host/{{handle() || 'yourhandle'}}</strong> to link people directly to your events.
          </div>
          <div style="display:flex;gap:8px">
            <input [ngModel]="handle()"
                   (ngModelChange)="handle.set($event)"
                   placeholder="e.g. smithfamilylights"
                   style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;outline:none;background:white"/>
            <button (click)="saveHandle()"
                    [disabled]="savingHandle() || handleLoading()"
                    [style.opacity]="savingHandle() || handleLoading() ? '0.6' : '1'"
                    style="padding:9px 16px;background:var(--accent);color:white;border:none;
                           border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">
              {{savingHandle() ? 'Saving…' : handleSaved() ? 'Saved!' : 'Save'}}
            </button>
          </div>
          <div *ngIf="handleError()"
               style="font-size:12px;color:#ef4444;margin-top:6px">
            {{handleError()}}
          </div>
        </div>

        <!-- Your Hosts -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-weight:700;font-size:14px;color:#0f172a">Your Hosts</div>
            <button (click)="showCreateHost.set(!showCreateHost())"
                    style="padding:6px 12px;background:var(--accent);color:white;border:none;
                           border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
              + Create Host
            </button>
          </div>

          <!-- Create form -->
          <div *ngIf="showCreateHost()"
               style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:14px">
            <input [ngModel]="newHostName()" (ngModelChange)="newHostName.set($event)"
                   placeholder="Display name (e.g. Clayton's BBQ)"
                   style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                          outline:none;margin-bottom:8px"/>
            <input [ngModel]="newHostHandle()" (ngModelChange)="newHostHandle.set($event)"
                   placeholder="handle (e.g. claytons-bbq)"
                   style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                          outline:none;margin-bottom:4px"/>
            <div style="font-size:11.5px;color:#64748b;margin-bottom:10px">
              eventmapster.com/host/{{newHostHandle() || 'yourhandle'}}
            </div>
            <div style="display:flex;gap:8px">
              <button (click)="createHost()"
                      [disabled]="creatingHost()"
                      [style.opacity]="creatingHost() ? '0.6' : '1'"
                      style="padding:8px 16px;background:var(--accent);color:white;border:none;
                             border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                {{creatingHost() ? 'Creating…' : 'Create'}}
              </button>
              <button (click)="showCreateHost.set(false)"
                      style="padding:8px 14px;background:none;border:1.5px solid #e2e8f0;
                             border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
                Cancel
              </button>
            </div>
            <div *ngIf="createHostError()"
                 style="font-size:12px;color:#ef4444;margin-top:6px">{{createHostError()}}</div>
          </div>

          <!-- Loading -->
          <div *ngIf="hostsLoading()"
               style="text-align:center;padding:20px 0;color:#94a3b8;font-size:13px">Loading…</div>

          <!-- Empty state -->
          <div *ngIf="!hostsLoading() && hosts().length === 0 && !showCreateHost()"
               style="text-align:center;padding:16px 0;color:#94a3b8;font-size:13px">
            No hosts yet. Create one to manage a brand's events.
          </div>

          <!-- Host cards -->
          <div *ngFor="let h of hosts()"
               style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px">

            <!-- View mode -->
            <div *ngIf="editingHostId() !== h.id && transferringHostId() !== h.id && confirmDeleteHostId() !== h.id">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <img *ngIf="h.avatarUrl" [src]="h.avatarUrl" [alt]="h.displayName"
                     style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
                <app-avatar *ngIf="!h.avatarUrl" [initials]="getInitials(h.displayName)" [size]="44"/>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:14px;color:#0f172a">{{h.displayName}}</div>
                  <div style="font-size:11.5px;color:#64748b;margin-top:1px">
                    eventmapster.com/host/{{h.handle}} · {{h.listingCount}} listing{{h.listingCount !== 1 ? 's' : ''}}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                <button (click)="startEditHost(h)"
                        style="padding:5px 12px;background:#e0f2fe;border:none;color:#0369a1;
                               border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
                  Edit
                </button>
                <button (click)="startTransferHost(h.id)"
                        style="padding:5px 12px;background:#f0fdf4;border:none;color:#166534;
                               border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
                  Transfer
                </button>
                <button (click)="confirmDeleteHost(h.id)"
                        [disabled]="h.listingCount > 0"
                        [title]="h.listingCount > 0 ? 'Remove all listings before deleting' : ''"
                        [style.opacity]="h.listingCount > 0 ? '0.4' : '1'"
                        style="padding:5px 12px;background:#fee2e2;border:none;color:#dc2626;
                               border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
                  Delete
                </button>
              </div>
            </div>

            <!-- Edit mode -->
            <div *ngIf="editingHostId() === h.id">
              <input [ngModel]="editHostName()" (ngModelChange)="editHostName.set($event)"
                     placeholder="Display name"
                     style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                            font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                            outline:none;margin-bottom:8px"/>
              <input [ngModel]="editHostHandle()" (ngModelChange)="editHostHandle.set($event)"
                     placeholder="handle"
                     style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                            font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                            outline:none;margin-bottom:4px"/>
              <div style="font-size:11.5px;color:#64748b;margin-bottom:8px">
                eventmapster.com/host/{{editHostHandle() || h.handle}}
              </div>
              <div style="margin-bottom:8px">
                <label style="font-size:12px;color:#64748b;font-weight:600;display:block;margin-bottom:4px">
                  Avatar photo
                </label>
                <input type="file" accept="image/*" (change)="onHostAvatarChange(h.id, $event)"
                       style="font-size:12px;color:#374151"/>
              </div>
              <div *ngIf="editHostError()"
                   style="font-size:12px;color:#ef4444;margin-bottom:8px">{{editHostError()}}</div>
              <div style="display:flex;gap:6px">
                <button (click)="saveHost(h.id)"
                        [disabled]="savingHostId() === h.id"
                        [style.opacity]="savingHostId() === h.id ? '0.6' : '1'"
                        style="padding:7px 14px;background:var(--accent);color:white;border:none;
                               border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                  {{savingHostId() === h.id ? 'Saving…' : 'Save'}}
                </button>
                <button (click)="cancelEditHost()"
                        style="padding:7px 12px;background:none;border:1.5px solid #e2e8f0;
                               border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
                  Cancel
                </button>
              </div>
            </div>

            <!-- Transfer mode -->
            <div *ngIf="transferringHostId() === h.id">
              <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px">
                Transfer "{{h.displayName}}" to another user
              </div>
              <input [ngModel]="transferHandle()" (ngModelChange)="transferHandle.set($event)"
                     placeholder="Recipient's handle"
                     style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                            font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                            outline:none;margin-bottom:8px"/>
              <div *ngIf="transferError()"
                   style="font-size:12px;color:#ef4444;margin-bottom:8px">{{transferError()}}</div>
              <div style="display:flex;gap:6px">
                <button (click)="doTransferHost(h.id)"
                        [disabled]="transferring()"
                        [style.opacity]="transferring() ? '0.6' : '1'"
                        style="padding:7px 14px;background:#dc2626;color:white;border:none;
                               border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                  {{transferring() ? 'Transferring…' : 'Transfer'}}
                </button>
                <button (click)="cancelTransferHost()"
                        style="padding:7px 12px;background:none;border:1.5px solid #e2e8f0;
                               border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
                  Cancel
                </button>
              </div>
            </div>

            <!-- Delete confirm -->
            <div *ngIf="confirmDeleteHostId() === h.id">
              <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:10px">
                Delete "{{h.displayName}}"? This cannot be undone.
              </div>
              <div style="display:flex;gap:6px">
                <button (click)="doDeleteHost(h.id)"
                        [disabled]="deletingHost()"
                        [style.opacity]="deletingHost() ? '0.6' : '1'"
                        style="padding:7px 14px;background:#dc2626;color:white;border:none;
                               border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                  {{deletingHost() ? 'Deleting…' : 'Yes, delete'}}
                </button>
                <button (click)="cancelDeleteHost()"
                        style="padding:7px 12px;background:none;border:1.5px solid #e2e8f0;
                               border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
                  Cancel
                </button>
              </div>
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
    if (this.user?.displayName) {
      this.displayName.set(this.user.displayName);
    }
    if (this.user) {
      this.listingApi.getHostListings(this.user.id).subscribe({
        next: resp => {
          this.handle.set(resp.user.handle ?? '');
          this.handleLoading.set(false);
        },
        error: () => this.handleLoading.set(false),
      });
      this.listingApi.getMyHosts().subscribe({
        next: h => { this.hosts.set(h); this.hostsLoading.set(false); },
        error: () => this.hostsLoading.set(false),
      });
    }
  }

  setTab(id: string) {
    this.activeTab.set(id as 'mine' | 'upvoted');
  }

  totalUpvotes() {
    return this.myListings().reduce((sum, d) => sum + d.upvoteCount, 0);
  }

  deletingId = signal<number | null>(null);
  displayName = signal('');
  savingDisplayName = signal(false);
  displayNameSaved = signal(false);
  handle = signal('');
  savingHandle = signal(false);
  handleSaved = signal(false);
  handleError = signal('');
  handleLoading = signal(true);

  hosts = signal<HostEntity[]>([]);
  hostsLoading = signal(true);
  showCreateHost = signal(false);
  newHostName = signal('');
  newHostHandle = signal('');
  creatingHost = signal(false);
  createHostError = signal('');
  editingHostId = signal<number | null>(null);
  editHostName = signal('');
  editHostHandle = signal('');
  editHostError = signal('');
  savingHostId = signal<number | null>(null);
  transferringHostId = signal<number | null>(null);
  transferHandle = signal('');
  transferring = signal(false);
  transferError = signal('');
  confirmDeleteHostId = signal<number | null>(null);
  deletingHost = signal(false);

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

  saveDisplayName() {
    this.savingDisplayName.set(true);
    this.displayNameSaved.set(false);
    this.listingApi.updateDisplayName(this.displayName()).subscribe({
      next: () => {
        this.savingDisplayName.set(false);
        this.displayNameSaved.set(true);
        setTimeout(() => this.displayNameSaved.set(false), 2500);
      },
      error: () => this.savingDisplayName.set(false),
    });
  }

  saveHandle() {
    const h = this.handle().trim().toLowerCase();
    if (!h || h.length < 3) {
      this.handleError.set('Handle must be at least 3 characters.');
      return;
    }
    if (h.length > 30) {
      this.handleError.set('Handle must be 30 characters or fewer.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(h)) {
      this.handleError.set('Handle may only contain lowercase letters, numbers, and hyphens.');
      return;
    }
    this.savingHandle.set(true);
    this.handleError.set('');
    this.listingApi.updateHandle(h).subscribe({
      next: () => {
        this.savingHandle.set(false);
        this.handleSaved.set(true);
        this.handle.set(h);
        setTimeout(() => this.handleSaved.set(false), 2000);
      },
      error: (err) => {
        this.savingHandle.set(false);
        this.handleError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
      },
    });
  }

  createHost() {
    const name = this.newHostName().trim();
    const handle = this.newHostHandle().trim().toLowerCase();
    if (!name) { this.createHostError.set('Name is required.'); return; }
    if (!handle || handle.length < 3) { this.createHostError.set('Handle must be at least 3 characters.'); return; }
    if (handle.length > 30) { this.createHostError.set('Handle must be 30 characters or fewer.'); return; }
    if (!/^[a-z0-9-]+$/.test(handle)) { this.createHostError.set('Handle may only contain lowercase letters, numbers, and hyphens.'); return; }

    this.creatingHost.set(true);
    this.createHostError.set('');
    this.listingApi.createHost(name, handle).subscribe({
      next: h => {
        this.hosts.update(list => [h, ...list]);
        this.newHostName.set('');
        this.newHostHandle.set('');
        this.showCreateHost.set(false);
        this.creatingHost.set(false);
      },
      error: (err) => {
        this.creatingHost.set(false);
        this.createHostError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
      },
    });
  }

  startEditHost(host: HostEntity) {
    this.editingHostId.set(host.id);
    this.editHostName.set(host.displayName);
    this.editHostHandle.set(host.handle);
    this.editHostError.set('');
  }

  cancelEditHost() {
    this.editingHostId.set(null);
    this.editHostError.set('');
  }

  saveHost(hostId: number) {
    const name = this.editHostName().trim();
    const handle = this.editHostHandle().trim().toLowerCase();
    if (!name) { this.editHostError.set('Name is required.'); return; }
    if (!handle || handle.length < 3) { this.editHostError.set('Handle must be at least 3 characters.'); return; }
    if (handle.length > 30) { this.editHostError.set('Handle must be 30 characters or fewer.'); return; }
    if (!/^[a-z0-9-]+$/.test(handle)) { this.editHostError.set('Handle may only contain lowercase letters, numbers, and hyphens.'); return; }

    this.savingHostId.set(hostId);
    this.editHostError.set('');
    this.listingApi.updateHost(hostId, name, handle).subscribe({
      next: updated => {
        this.hosts.update(list => list.map(h => h.id === hostId ? updated : h));
        this.editingHostId.set(null);
        this.savingHostId.set(null);
      },
      error: (err) => {
        this.savingHostId.set(null);
        this.editHostError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
      },
    });
  }

  onHostAvatarChange(hostId: number, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.listingApi.uploadHostAvatar(hostId, file).subscribe({
      next: updated => this.hosts.update(list => list.map(h => h.id === hostId ? updated : h)),
      error: () => {},
    });
  }

  startTransferHost(hostId: number) {
    this.transferringHostId.set(hostId);
    this.transferHandle.set('');
    this.transferError.set('');
  }

  cancelTransferHost() {
    this.transferringHostId.set(null);
    this.transferError.set('');
  }

  doTransferHost(hostId: number) {
    const handle = this.transferHandle().trim().toLowerCase();
    if (!handle) { this.transferError.set('Enter the recipient\'s handle.'); return; }
    this.transferring.set(true);
    this.transferError.set('');
    this.listingApi.transferHost(hostId, handle).subscribe({
      next: () => {
        this.hosts.update(list => list.filter(h => h.id !== hostId));
        this.transferringHostId.set(null);
        this.transferring.set(false);
      },
      error: (err) => {
        this.transferring.set(false);
        this.transferError.set(
          err.status === 404 ? 'No user found with that handle.' :
          err.status === 400 ? 'You already own this host.' :
          'Something went wrong.'
        );
      },
    });
  }

  confirmDeleteHost(hostId: number) {
    this.confirmDeleteHostId.set(hostId);
  }

  cancelDeleteHost() {
    this.confirmDeleteHostId.set(null);
  }

  doDeleteHost(hostId: number) {
    this.deletingHost.set(true);
    this.listingApi.deleteHost(hostId).subscribe({
      next: () => {
        this.hosts.update(list => list.filter(h => h.id !== hostId));
        this.confirmDeleteHostId.set(null);
        this.deletingHost.set(false);
      },
      error: () => {
        this.deletingHost.set(false);
        this.confirmDeleteHostId.set(null);
      },
    });
  }
}
