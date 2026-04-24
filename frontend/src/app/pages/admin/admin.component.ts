import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Report, ListingSummary, CATEGORY_LABELS } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';

type StatusFilter = 'OPEN' | 'RESOLVED' | 'ALL';
type AdminTab = 'reports' | 'listings';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:700px;margin:0 auto;padding:28px 20px 0">

        <!-- Header -->
        <div style="margin-bottom:24px">
          <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">
            Admin Dashboard
          </div>
          <div style="font-size:13.5px;color:#64748b">Moderate reports and manage listings</div>
        </div>

        <!-- Top-level tabs -->
        <div style="display:flex;background:white;border-radius:12px;padding:4px;margin-bottom:20px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <button (click)="adminTab.set('reports')"
                  [style.background]="adminTab() === 'reports' ? 'var(--accent)' : 'none'"
                  [style.color]="adminTab() === 'reports' ? 'white' : '#64748b'"
                  style="flex:1;border:none;padding:9px;border-radius:9px;font-size:13.5px;
                         font-weight:600;cursor:pointer;transition:all 0.15s">
            Reports
          </button>
          <button (click)="switchToListings()"
                  [style.background]="adminTab() === 'listings' ? 'var(--accent)' : 'none'"
                  [style.color]="adminTab() === 'listings' ? 'white' : '#64748b'"
                  style="flex:1;border:none;padding:9px;border-radius:9px;font-size:13.5px;
                         font-weight:600;cursor:pointer;transition:all 0.15s">
            Listings
          </button>
        </div>

        <!-- ── Reports tab ── -->
        <ng-container *ngIf="adminTab() === 'reports'">
          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
            <div *ngFor="let stat of stats()"
                 style="background:white;border-radius:12px;padding:16px;
                        box-shadow:0 1px 6px rgba(0,0,0,0.06);text-align:center">
              <div style="font-weight:800;font-size:24px;color:#0f172a">{{stat.value}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">{{stat.label}}</div>
            </div>
          </div>

          <div style="background:white;border-radius:16px;overflow:hidden;
                      box-shadow:0 1px 6px rgba(0,0,0,0.06)">
            <div style="display:flex;border-bottom:1px solid #f1f5f9">
              <button *ngFor="let f of filters" (click)="setFilter(f.id)"
                      [style.color]="statusFilter() === f.id ? 'var(--accent-dark)' : '#64748b'"
                      [style.border-bottom]="statusFilter() === f.id ? '2px solid var(--accent)' : '2px solid transparent'"
                      style="flex:1;border:none;border-top:none;border-left:none;border-right:none;
                             background:none;padding:13px;font-size:13.5px;font-weight:600;
                             cursor:pointer;transition:color 0.15s">
                {{f.label}}
                <span style="font-size:11px;color:#94a3b8;font-weight:500"> ({{getCount(f.id)}})</span>
              </button>
            </div>

            <div *ngIf="loadingReports()" style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
              Loading…
            </div>

            <ng-container *ngIf="!loadingReports()">
              <div *ngFor="let r of filteredReports(); let last = last"
                   [style.border-bottom]="last ? 'none' : '1px solid #f8fafc'"
                   style="padding:18px 20px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span [style.background]="getReasonBg(r.reason)"
                            [style.color]="getReasonColor(r.reason)"
                            style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px">
                        {{r.reason}}
                      </span>
                      <span [style.background]="r.status === 'OPEN' ? '#fef3c7' : '#dcfce7'"
                            [style.color]="r.status === 'OPEN' ? '#92400e' : '#166534'"
                            style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px">
                        {{r.status}}
                      </span>
                    </div>
                    <div style="font-weight:600;font-size:14px;color:#0f172a;margin-bottom:3px">
                      {{r.displayTitle}}
                    </div>
                    <div style="font-size:12.5px;color:#64748b;margin-bottom:6px">{{r.notes}}</div>
                    <div style="font-size:11.5px;color:#9ca3af">{{r.createdAt}}</div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0">
                    <button *ngIf="r.status === 'OPEN'" (click)="resolve(r)"
                            style="padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:600;
                                   background:#22c55e;color:white;border:none;cursor:pointer">
                      Resolve
                    </button>
                    <button *ngIf="r.status === 'OPEN'" (click)="dismiss(r)"
                            style="padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:600;
                                   background:none;border:1.5px solid #e2e8f0;color:#64748b;cursor:pointer">
                      Dismiss
                    </button>
                    <span *ngIf="r.status !== 'OPEN'"
                          style="font-size:12px;color:#94a3b8;text-align:center">Done</span>
                  </div>
                </div>
              </div>
              <div *ngIf="filteredReports().length === 0"
                   style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
                No reports to show
              </div>
            </ng-container>
          </div>
        </ng-container>

        <!-- ── Listings tab ── -->
        <ng-container *ngIf="adminTab() === 'listings'">
          <div *ngIf="loadingDisplays()" style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
            Loading…
          </div>

          <div *ngIf="!loadingDisplays()"
               style="background:white;border-radius:16px;overflow:hidden;
                      box-shadow:0 1px 6px rgba(0,0,0,0.06)">
            <div *ngFor="let d of allListings(); let last = last"
                 [style.border-bottom]="last ? 'none' : '1px solid #f8fafc'"
                 style="padding:16px 20px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                    <span [style.background]="d.isActive ? '#dcfce7' : '#fee2e2'"
                          [style.color]="d.isActive ? '#166534' : '#991b1b'"
                          style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;flex-shrink:0">
                      {{d.isActive ? 'Active' : 'Inactive'}}
                    </span>
                    <span style="font-weight:600;font-size:14px;color:#0f172a;
                                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      {{d.title}}
                    </span>
                  </div>
                  <div style="font-size:12px;color:#64748b">
                    {{categoryLabels[d.category]}} · {{d.city}}{{d.state ? ', ' + d.state : ''}} · {{d.upvoteCount}} upvotes
                  </div>
                </div>
                <div style="display:flex;gap:7px;flex-shrink:0;align-items:center">
                  <!-- Deactivate/Reactivate -->
                  <button (click)="toggleActive(d)"
                          [style.background]="d.isActive ? '#fef3c7' : '#dcfce7'"
                          [style.color]="d.isActive ? '#92400e' : '#166534'"
                          style="padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;
                                 border:none;cursor:pointer">
                    {{d.isActive ? 'Deactivate' : 'Reactivate'}}
                  </button>

                  <!-- Delete with confirmation -->
                  <ng-container *ngIf="deletingDisplayId() !== d.id">
                    <button (click)="confirmDisplayDelete(d.id)"
                            style="padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;
                                   background:#fee2e2;color:#dc2626;border:none;cursor:pointer">
                      Delete
                    </button>
                  </ng-container>
                  <ng-container *ngIf="deletingDisplayId() === d.id">
                    <span style="font-size:12px;color:#374151;font-weight:600">Sure?</span>
                    <button (click)="doDisplayDelete(d.id)"
                            style="padding:5px 10px;border-radius:7px;font-size:12px;font-weight:700;
                                   background:#dc2626;color:white;border:none;cursor:pointer">
                      Yes
                    </button>
                    <button (click)="deletingDisplayId.set(null)"
                            style="padding:5px 10px;border-radius:7px;font-size:12px;font-weight:600;
                                   background:none;border:1.5px solid #e2e8f0;color:#64748b;cursor:pointer">
                      No
                    </button>
                  </ng-container>
                </div>
              </div>
            </div>

            <div *ngIf="allListings().length === 0"
                 style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
              No listings found
            </div>
          </div>
        </ng-container>

      </div>
    </div>
  `
})
export class AdminComponent implements OnInit {
  adminTab = signal<AdminTab>('reports');
  statusFilter = signal<StatusFilter>('OPEN');
  reports = signal<Report[]>([]);
  loadingReports = signal(true);
  allListings = signal<ListingSummary[]>([]);
  loadingDisplays = signal(false);
  deletingDisplayId = signal<number | null>(null);
  categoryLabels = CATEGORY_LABELS;

  filters: { id: StatusFilter; label: string }[] = [
    { id: 'OPEN', label: 'Open' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'ALL', label: 'All' },
  ];

  private listingApi = inject(ListingApiService);

  ngOnInit() {
    this.loadReports();
  }

  switchToListings() {
    this.adminTab.set('listings');
    if (this.allListings().length === 0) {
      this.loadListings();
    }
  }

  setFilter(id: StatusFilter) {
    this.statusFilter.set(id);
    this.loadReports();
  }

  private loadReports() {
    this.loadingReports.set(true);
    this.listingApi.getReports(this.statusFilter()).subscribe({
      next: page => { this.reports.set(page.content); this.loadingReports.set(false); },
      error: () => this.loadingReports.set(false),
    });
  }

  private loadListings() {
    this.loadingDisplays.set(true);
    this.listingApi.adminGetListings().subscribe({
      next: page => { this.allListings.set(page.content); this.loadingDisplays.set(false); },
      error: () => this.loadingDisplays.set(false),
    });
  }

  stats = computed(() => {
    const all = this.reports();
    return [
      { label: 'Open Reports', value: all.filter(r => r.status === 'OPEN').length },
      { label: 'Resolved', value: all.filter(r => r.status === 'RESOLVED').length },
      { label: 'Total Loaded', value: all.length },
    ];
  });

  filteredReports = computed(() => {
    const f = this.statusFilter();
    return f === 'ALL' ? this.reports() : this.reports().filter(r => r.status === f);
  });

  getCount(f: StatusFilter) {
    return f === 'ALL' ? this.reports().length : this.reports().filter(r => r.status === f).length;
  }

  resolve(r: Report) {
    this.listingApi.updateReport(r.id, 'RESOLVED').subscribe({
      next: updated => this.reports.update(list => list.map(x => x.id === r.id ? updated : x)),
    });
  }

  dismiss(r: Report) {
    this.listingApi.updateReport(r.id, 'DISMISSED').subscribe({
      next: updated => this.reports.update(list => list.map(x => x.id === r.id ? updated : x)),
    });
  }

  toggleActive(d: ListingSummary) {
    this.listingApi.adminSetListingActive(d.id, !d.isActive).subscribe({
      next: updated => this.allListings.update(list => list.map(x => x.id === d.id ? { ...x, isActive: updated.isActive } : x)),
    });
  }

  confirmDisplayDelete(id: number) {
    this.deletingDisplayId.set(id);
  }

  doDisplayDelete(id: number) {
    this.listingApi.adminDeleteListing(id).subscribe({
      next: () => {
        this.allListings.update(list => list.filter(d => d.id !== id));
        this.deletingDisplayId.set(null);
      },
      error: () => this.deletingDisplayId.set(null),
    });
  }

  getReasonBg(reason: string) {
    const map: Record<string, string> = { 'WRONG_ADDRESS': '#ede9fe', 'OFFENSIVE': '#fee2e2', 'SPAM': '#fef3c7', 'INACTIVE': '#e0f2fe' };
    return map[reason] ?? '#f1f5f9';
  }

  getReasonColor(reason: string) {
    const map: Record<string, string> = { 'WRONG_ADDRESS': '#5b21b6', 'OFFENSIVE': '#991b1b', 'SPAM': '#92400e', 'INACTIVE': '#075985' };
    return map[reason] ?? '#374151';
  }
}
