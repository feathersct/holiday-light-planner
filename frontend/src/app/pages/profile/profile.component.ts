import { Component, Input, Output, EventEmitter, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListingSummary, User, HostEntity, getInitials } from '../../models/listing.model';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { UpvoteService } from '../../services/upvote.service';
import { ListingApiService } from '../../services/listing-api.service';
import { UserService } from '../../services/user.service';
import { HostService } from '../../services/host.service';

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
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{upvotedListings().length}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Upvoted</div>
            </div>
          </div>
        </div>

        <!-- Display name setting -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">
            Display name
          </div>
          <div style="font-size:12.5px;color:#64748b;margin-bottom:12px">
            Shown for any community listings. Does not affect listings posted under a host.
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
               (click)="manageHost.emit(h)"
               style="display:flex;align-items:center;gap:12px;padding:14px;
                      border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:10px;
                      cursor:pointer;transition:border-color 0.15s;background:white"
               (mouseenter)="$any($event.target).style.borderColor='var(--accent)'"
               (mouseleave)="$any($event.target).style.borderColor='#e2e8f0'">
            <img *ngIf="h.avatarUrl" [src]="h.avatarUrl" [alt]="h.displayName"
                 style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
            <app-avatar *ngIf="!h.avatarUrl" [initials]="getInitials(h.displayName)" [size]="44"/>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px;color:#0f172a">{{h.displayName}}</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:1px">
                &#64;{{h.handle}} · {{h.listingCount}} listing{{h.listingCount !== 1 ? 's' : ''}}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loadingUpvoted()"
             style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
          Loading…
        </div>

        <!-- Upvoted -->
        <div *ngIf="!loadingUpvoted()">
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
  @Output() manageHost = new EventEmitter<HostEntity>();

  upvotedListings = signal<ListingSummary[]>([]);
  loadingUpvoted = signal(true);

  getInitials = getInitials;

  private listingApi = inject(ListingApiService);
  private userService = inject(UserService);
  private hostService = inject(HostService);
  upvoteService = inject(UpvoteService);

  ngOnInit() {
    this.listingApi.getUpvotedListings().subscribe({
      next: d => { this.upvotedListings.set(d); this.loadingUpvoted.set(false); },
      error: () => this.loadingUpvoted.set(false),
    });
    if (this.user?.displayName) {
      this.displayName.set(this.user.displayName);
    }
    if (this.user) {
      this.userService.getMyHosts().subscribe({
        next: h => { this.hosts.set(h); this.hostsLoading.set(false); },
        error: () => this.hostsLoading.set(false),
      });
    } else {
      this.hostsLoading.set(false);
    }
  }

  displayName = signal('');
  savingDisplayName = signal(false);
  displayNameSaved = signal(false);

  hosts = signal<HostEntity[]>([]);
  hostsLoading = signal(true);
  showCreateHost = signal(false);
  newHostName = signal('');
  newHostHandle = signal('');
  creatingHost = signal(false);
  createHostError = signal('');

  saveDisplayName() {
    this.savingDisplayName.set(true);
    this.displayNameSaved.set(false);
    this.userService.updateDisplayName(this.displayName()).subscribe({
      next: () => {
        this.savingDisplayName.set(false);
        this.displayNameSaved.set(true);
        setTimeout(() => this.displayNameSaved.set(false), 2500);
      },
      error: () => this.savingDisplayName.set(false),
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
    this.hostService.createHost(name, handle).subscribe({
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

}
