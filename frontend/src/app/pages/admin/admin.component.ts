import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Report } from '../../models/display.model';
import { DisplayApiService } from '../../services/display-api.service';

type StatusFilter = 'OPEN' | 'RESOLVED' | 'ALL';

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
            ⚙ Admin Dashboard
          </div>
          <div style="font-size:13.5px;color:#64748b">Moderate reports and manage displays</div>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
          <div *ngFor="let stat of stats()"
               style="background:white;border-radius:12px;padding:16px;
                      box-shadow:0 1px 6px rgba(0,0,0,0.06);text-align:center">
            <div style="font-weight:800;font-size:24px;color:#0f172a">{{stat.value}}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">{{stat.label}}</div>
          </div>
        </div>

        <!-- Reports section -->
        <div style="background:white;border-radius:16px;overflow:hidden;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <!-- Tab bar -->
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

          <!-- Loading -->
          <div *ngIf="loading()" style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
            Loading…
          </div>

          <!-- Report rows -->
          <ng-container *ngIf="!loading()">
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
      </div>
    </div>
  `
})
export class AdminComponent implements OnInit {
  statusFilter = signal<StatusFilter>('OPEN');
  reports = signal<Report[]>([]);
  loading = signal(true);

  filters: { id: StatusFilter; label: string }[] = [
    { id: 'OPEN', label: 'Open' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'ALL', label: 'All' },
  ];

  constructor(private displayApi: DisplayApiService) {}

  ngOnInit() {
    this.loadReports();
  }

  setFilter(id: StatusFilter) {
    this.statusFilter.set(id);
    this.loadReports();
  }

  private loadReports() {
    this.loading.set(true);
    this.displayApi.getReports(this.statusFilter()).subscribe({
      next: page => { this.reports.set(page.content); this.loading.set(false); },
      error: () => this.loading.set(false),
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
    this.displayApi.updateReport(r.id, 'RESOLVED').subscribe({
      next: updated => this.reports.update(list => list.map(x => x.id === r.id ? updated : x)),
    });
  }

  dismiss(r: Report) {
    this.displayApi.updateReport(r.id, 'DISMISSED').subscribe({
      next: updated => this.reports.update(list => list.map(x => x.id === r.id ? updated : x)),
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
