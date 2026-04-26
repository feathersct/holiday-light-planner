import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HostSearchResult, HostUser, getInitials } from '../../models/listing.model';
import { HostService } from '../../services/host.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

@Component({
  selector: 'app-host-search',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:560px;margin:0 auto;padding:28px 20px 0">

        <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">Find a Host</div>
        <div style="font-size:13.5px;color:#64748b;margin-bottom:24px">
          Search for a food truck, market, or host by name.
        </div>

        <!-- Search input -->
        <div style="position:relative;margin-bottom:8px">
          <div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;
                      box-shadow:0 2px 8px rgba(0,0,0,0.06);
                      display:flex;align-items:center;padding:11px 14px;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="flex-shrink:0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input [(ngModel)]="query"
                   (ngModelChange)="onQueryChange($event)"
                   placeholder="Search hosts…"
                   style="flex:1;border:none;outline:none;font-size:14px;color:#0f172a;background:transparent"/>
            <button *ngIf="query" (click)="clearQuery()"
                    style="background:none;border:none;cursor:pointer;padding:0;
                           color:#94a3b8;font-size:18px;line-height:1">×</button>
          </div>

          <!-- Autocomplete dropdown -->
          <div *ngIf="showDropdown"
               style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;
                      background:white;border:1.5px solid #e2e8f0;border-radius:12px;
                      box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden">

            <!-- Loading -->
            <div *ngIf="searching"
                 style="padding:16px;text-align:center;color:#94a3b8;font-size:13.5px">
              Searching…
            </div>

            <!-- No results -->
            <div *ngIf="!searching && results.length === 0"
                 style="padding:16px;text-align:center;color:#94a3b8;font-size:13.5px">
              No hosts found
            </div>

            <!-- Results -->
            <button *ngFor="let r of results; let last = last"
                    (click)="selectHost(r)"
                    [style.border-bottom]="last ? 'none' : '1px solid #f1f5f9'"
                    style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;
                           background:none;border-left:none;border-right:none;border-top:none;
                           cursor:pointer;text-align:left">
              <img *ngIf="r.avatarUrl" [src]="r.avatarUrl" [alt]="r.name"
                   style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
              <app-avatar *ngIf="!r.avatarUrl" [initials]="getInitials(r.displayName ?? r.name)" [size]="36"/>
              <div>
                <div style="font-weight:700;font-size:14px;color:#0f172a">
                  {{r.displayName ?? r.name}}
                </div>
                <div *ngIf="r.displayName && r.displayName !== r.name"
                     style="font-size:12px;color:#94a3b8">{{r.name}}</div>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class HostSearchComponent {
  @Output() viewHost = new EventEmitter<HostUser>();

  query = '';
  results: HostSearchResult[] = [];
  searching = false;
  showDropdown = false;

  getInitials = getInitials;

  private hostService = inject(HostService);
  private debounceTimer: any = null;

  onQueryChange(q: string) {
    clearTimeout(this.debounceTimer);
    if (q.length < 2) {
      this.showDropdown = false;
      this.results = [];
      return;
    }
    this.searching = true;
    this.showDropdown = true;
    this.debounceTimer = setTimeout(() => {
      this.hostService.searchHosts(q).subscribe({
        next: (results: any) => {
          this.results = results;
          this.searching = false;
        },
        error: () => {
          this.showDropdown = false;
          this.searching = false;
        },
      });
    }, 300);
  }

  selectHost(result: HostSearchResult) {
    this.showDropdown = false;
    this.viewHost.emit({ id: result.id, name: result.name, displayName: result.displayName, avatarUrl: result.avatarUrl, handle: result.handle });
  }

  clearQuery() {
    this.query = '';
    this.showDropdown = false;
    this.results = [];
  }
}
