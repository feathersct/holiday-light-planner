import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Display, SAMPLE_DISPLAYS, User } from '../../models/display.model';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { UpvoteService } from '../../services/upvote.service';

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
            <app-avatar [initials]="user?.avatar || '?'" [size]="60"/>
            <div>
              <div style="font-weight:800;font-size:19px;color:#0f172a">{{user?.name || 'Guest'}}</div>
              <div style="font-size:13px;color:#64748b;margin-top:2px">{{user?.email || ''}}</div>
            </div>
          </div>
          <div style="display:flex;gap:24px">
            <div style="text-align:center">
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{myDisplays.length}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Displays</div>
            </div>
            <div style="text-align:center">
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{totalUpvotes}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Upvotes received</div>
            </div>
            <div style="text-align:center">
              <div style="font-weight:800;font-size:22px;color:#0f172a">{{upvotedDisplays.length}}</div>
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

        <!-- My Displays -->
        <div *ngIf="activeTab() === 'mine'">
          <div *ngIf="myDisplays.length === 0"
               style="text-align:center;padding:48px 0;color:#94a3b8">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" style="margin-bottom:12px;opacity:0.5">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            </svg>
            <div style="font-size:14px">You haven't submitted any displays yet</div>
          </div>
          <app-display-card *ngFor="let d of myDisplays" [display]="d"
            [upvoted]="isUpvoted(d.id)" [showDetails]="true"
            (select)="selectDisplay.emit(d)" (upvote)="upvoteService.toggle(d.id)"
            (viewDetails)="selectDisplay.emit(d)"/>
        </div>

        <!-- Upvoted -->
        <div *ngIf="activeTab() === 'upvoted'">
          <div *ngIf="upvotedDisplays.length === 0"
               style="text-align:center;padding:48px 0;color:#94a3b8">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" style="margin-bottom:12px;opacity:0.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <div style="font-size:14px">No upvoted displays yet</div>
          </div>
          <app-display-card *ngFor="let d of upvotedDisplays" [display]="d"
            [upvoted]="true" [showDetails]="true"
            (select)="selectDisplay.emit(d)" (upvote)="upvoteService.toggle(d.id)"
            (viewDetails)="selectDisplay.emit(d)"/>
        </div>

      </div>
    </div>
  `
})
export class ProfileComponent {
  @Input() user: User | null = null;
  @Output() selectDisplay = new EventEmitter<Display>();

  activeTab = signal<'mine' | 'upvoted'>('mine');
  tabs = [
    { id: 'mine', label: 'My Displays' },
    { id: 'upvoted', label: 'Upvoted' },
  ];

  constructor(public upvoteService: UpvoteService) {}

  setTab(id: string) {
    this.activeTab.set(id as 'mine' | 'upvoted');
  }

  get myDisplays() {
    return SAMPLE_DISPLAYS.slice(0, 2);
  }

  get upvotedDisplays() {
    const ids = this.upvoteService.upvotedIds();
    return SAMPLE_DISPLAYS.filter(d => ids.has(d.id));
  }

  get totalUpvotes() {
    return this.myDisplays.reduce((sum, d) => sum + d.upvote_count, 0);
  }

  isUpvoted(id: number) {
    return this.upvoteService.upvotedIds().has(id);
  }
}
