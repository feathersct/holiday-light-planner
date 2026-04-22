import {
  Component, OnInit, OnDestroy, AfterViewInit, Input, Output, EventEmitter,
  ViewChild, ElementRef, signal, computed, effect, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DisplaySummary, Tag, TYPE_COLORS } from '../../models/display.model';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { TagBadgeComponent } from '../../shared/tag-badge/tag-badge.component';
import { UpvoteButtonComponent } from '../../shared/upvote-button/upvote-button.component';
import { User } from '../../models/display.model';
import { DisplayApiService } from '../../services/display-api.service';

const TILE_LAYERS: Record<string, { url: string; attr: string }> = {
  light:    { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',  attr: '© OpenStreetMap © CARTO' },
  dark:     { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',   attr: '© OpenStreetMap © CARTO' },
  standard: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',              attr: '© OpenStreetMap contributors' },
};

const SNAPS = { peek: 82, half: 42, full: 4 };

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DisplayCardComponent, TagBadgeComponent, UpvoteButtonComponent],
  template: `
    <!-- ── Mobile layout ── -->
    <div *ngIf="isMobile" style="position:fixed;top:58px;left:0;right:0;bottom:64px;z-index:1">
      <div #mapContainer style="position:absolute;inset:0"></div>

      <!-- Floating search + filters -->
      <div style="position:absolute;top:10px;left:10px;right:10px;z-index:400;
                  display:flex;flex-direction:column;gap:8px;pointer-events:none">
        <div style="pointer-events:all;background:white;border-radius:12px;
                    box-shadow:0 4px 16px rgba(0,0,0,0.12);border:1px solid #e2e8f0;
                    display:flex;align-items:center;padding:10px 14px;gap:8px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="flex-shrink:0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input [(ngModel)]="searchQuery"
                 (keydown.enter)="searchLocation()"
                 placeholder="Search neighbourhood or city…"
                 style="flex:1;border:none;outline:none;font-size:14px;color:#0f172a;background:transparent"/>
        </div>
        <div style="pointer-events:all;background:white;border-radius:12px;
                    box-shadow:0 4px 16px rgba(0,0,0,0.1);border:1px solid #e2e8f0;
                    padding-top:10px;overflow:hidden">
          <ng-container *ngTemplateOutlet="mobileFilters"></ng-container>
        </div>
      </div>

      <!-- Plan a Tour button -->
      <button (click)="showTour = true"
              [style.bottom]="'calc(' + (100 - snaps[snapKey]) + '% + 16px)'"
              style="position:absolute;left:50%;transform:translateX(-50%);z-index:490;
                     background:#0f172a;color:white;border:none;padding:9px 20px;
                     border-radius:99px;font-size:13px;font-weight:700;cursor:pointer;
                     box-shadow:0 4px 16px rgba(15,23,42,0.3);
                     display:flex;align-items:center;gap:7px;white-space:nowrap;
                     transition:bottom 0.32s cubic-bezier(0.32,0.72,0,1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Plan a Tour
        <span style="background:rgba(245,158,11,0.25);color:#f59e0b;font-size:9px;
                     font-weight:800;padding:2px 5px;border-radius:99px">SOON</span>
      </button>

      <!-- Bottom sheet -->
      <div #sheetEl
           [style.transform]="dragging ? '' : 'translateY(' + snaps[snapKey] + '%)'"
           [style.transition]="dragging ? 'none' : 'transform 0.32s cubic-bezier(0.32,0.72,0,1)'"
           (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)"
           style="position:absolute;left:0;right:0;bottom:0;height:96%;z-index:500;
                  display:flex;flex-direction:column">
        <div style="background:white;border-radius:18px 18px 0 0;
                    box-shadow:0 -4px 24px rgba(0,0,0,0.12);flex:1;
                    display:flex;flex-direction:column;overflow:hidden">
          <!-- Handle -->
          <div style="padding:10px 0 8px;display:flex;flex-direction:column;
                      align-items:center;gap:10px;cursor:grab;flex-shrink:0">
            <div style="width:40px;height:4px;border-radius:99px;background:#cbd5e1"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;
                        width:100%;padding:0 16px">
              <span style="font-size:13px;font-weight:700;color:#0f172a">
                {{filtered.length}} {{filtered.length === 1 ? 'display' : 'displays'}}
              </span>
              <div style="display:flex;gap:6px">
                <button *ngFor="let k of snapKeys" (click)="snapKey = k"
                        [style.background]="snapKey === k ? 'var(--accent)' : '#e2e8f0'"
                        style="width:8px;height:8px;border-radius:50%;border:none;
                               padding:0;cursor:pointer"></button>
              </div>
            </div>
          </div>
          <!-- Selected card -->
          <div *ngIf="selected" style="padding:0 12px 10px;flex-shrink:0">
            <div style="background:#f8fafc;border-radius:12px;padding:12px 14px;
                        border:2px solid var(--accent);position:relative">
              <button (click)="selected = null"
                      style="position:absolute;top:8px;right:8px;background:#e2e8f0;border:none;
                             border-radius:50%;width:24px;height:24px;cursor:pointer;
                             font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
              <div style="font-weight:700;font-size:14px;margin-bottom:2px;padding-right:28px;color:#0f172a">{{selected.title}}</div>
              <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">📍 {{selected.city}}, {{selected.state}}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
                <app-tag-badge *ngFor="let t of selected.tags.slice(0,3)" [tag]="t.name" [small]="true"/>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <app-upvote-button [count]="selected.upvoteCount"
                  [upvoted]="isUpvoted(selected.id)" size="sm"
                  (toggled)="handleUpvote(selected.id)"/>
                <button (click)="viewDetails.emit(selected)"
                        style="background:#0f172a;color:white;border:none;padding:7px 14px;
                               border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer">
                  Details →
                </button>
              </div>
            </div>
          </div>
          <!-- Sort -->
          <div style="display:flex;justify-content:flex-end;padding:4px 14px 8px;flex-shrink:0">
            <select [(ngModel)]="sortBy" style="font-size:12px;border:1.5px solid #e2e8f0;
                    border-radius:7px;padding:4px 8px;background:white;color:#475569;
                    outline:none;cursor:pointer">
              <option value="popular">Most upvoted</option>
              <option value="recent">Recently added</option>
            </select>
          </div>
          <!-- Cards -->
          <div style="overflow-y:auto;flex:1;padding:0 11px 20px;-webkit-overflow-scrolling:touch">
            <app-display-card *ngFor="let d of filtered"
              [display]="d" [isSelected]="selected?.id === d.id"
              [upvoted]="isUpvoted(d.id)"
              (select)="selectDisplay(d)" (viewDetails)="viewDetails.emit($event)"
              (upvote)="handleUpvote(d.id)"/>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Desktop layout ── -->
    <div *ngIf="!isMobile" style="display:flex;position:fixed;top:58px;left:0;right:0;bottom:0;z-index:1">
      <!-- Sidebar -->
      <div style="width:372px;flex-shrink:0;display:flex;flex-direction:column;
                  background:#f8fafc;border-right:1px solid #e2e8f0;z-index:10;overflow:hidden">
        <!-- Search -->
        <div style="padding:11px 13px;background:white;border-bottom:1px solid #e9ecf0">
          <div style="position:relative">
            <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none"
                 width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input [(ngModel)]="searchQuery"
                   (keydown.enter)="searchLocation()"
                   placeholder="Search by neighbourhood or city…"
                   style="width:100%;padding:9px 12px 9px 33px;border:1.5px solid #e2e8f0;
                          border-radius:9px;font-size:13px;outline:none;background:#f8fafc;
                          box-sizing:border-box;color:#0f172a"
                   (focus)="$any($event.target).style.borderColor='var(--accent)'"
                   (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
          </div>
        </div>
        <!-- Filter bar -->
        <ng-container *ngTemplateOutlet="desktopFilters"></ng-container>
        <!-- Count + sort -->
        <div style="padding:8px 14px;background:white;border-bottom:1px solid #e9ecf0;
                    display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:#94a3b8;font-weight:500">
            {{filtered.length}} {{filtered.length === 1 ? 'display' : 'displays'}}
          </span>
          <select [(ngModel)]="sortBy" style="font-size:12px;border:1.5px solid #e2e8f0;
                  border-radius:7px;padding:4px 8px;background:white;cursor:pointer;
                  color:#475569;outline:none">
            <option value="popular">Most upvoted</option>
            <option value="recent">Recently added</option>
          </select>
        </div>
        <!-- Welcome card (logged out) -->
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column">
          <div *ngIf="!user && !welcomeDismissed"
               style="margin:12px 11px 2px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);
                      border-radius:14px;padding:18px 16px;color:white;position:relative;flex-shrink:0">
            <button (click)="dismissWelcome()"
                    style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.15);
                           border:none;border-radius:50%;width:24px;height:24px;color:white;
                           cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:36px;height:36px;border-radius:10px;
                          background:linear-gradient(135deg,var(--accent),#ef4444);
                          display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l-1.41 1.41M6.34 17.66l-1.41 1.41" stroke="white" stroke-width="2"/>
                </svg>
              </div>
              <div>
                <div style="font-weight:800;font-size:14px">Welcome to Luminary</div>
                <div style="font-size:12px;opacity:0.7;margin-top:1px">Community light display map</div>
              </div>
            </div>
            <p style="font-size:12.5px;line-height:1.6;opacity:0.85;margin:0 0 14px">
              Discover the most spectacular light displays near you. Sign in free to upvote favourites and add your own.
            </p>
            <div style="display:flex;gap:8px">
              <button (click)="needAuth.emit()"
                      style="flex:1;padding:8px 0;background:var(--accent);color:white;
                             border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
                Sign in free
              </button>
              <button (click)="dismissWelcome()"
                      style="padding:8px 14px;background:rgba(255,255,255,0.12);color:white;
                             border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer">
                Browse first
              </button>
            </div>
          </div>
          <!-- Cards list -->
          <div style="padding:12px 11px;flex:1">
            <div *ngIf="filtered.length === 0" style="padding:48px 24px;display:flex;flex-direction:column;align-items:center;text-align:center">
              <div style="width:72px;height:72px;border-radius:20px;background:var(--accent-bg);
                          display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:var(--accent)">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </div>
              <div style="font-weight:800;font-size:16px;color:#0f172a;margin-bottom:6px">No displays found</div>
              <div style="font-size:13.5px;color:#64748b;line-height:1.6;max-width:280px;margin-bottom:20px">No displays match your current filters. Try broadening your search.</div>
              <button (click)="clearFilters()"
                      style="background:#0f172a;color:white;border:none;padding:10px 22px;
                             border-radius:10px;font-size:13.5px;font-weight:700;cursor:pointer">
                Clear filters
              </button>
            </div>
            <app-display-card *ngFor="let d of filtered"
              [display]="d" [isSelected]="selected?.id === d.id"
              [upvoted]="isUpvoted(d.id)"
              (select)="selectDisplay(d)" (viewDetails)="viewDetails.emit($event)"
              (upvote)="handleUpvote(d.id)"/>
          </div>
        </div>
      </div>

      <!-- Map -->
      <div #mapContainer style="flex:1;position:relative">
        <!-- Plan a Tour -->
        <button (click)="showTour = true"
                style="position:absolute;bottom:28px;left:50%;transform:translateX(-50%);
                       z-index:10;background:#0f172a;color:white;border:none;
                       padding:10px 22px;border-radius:99px;font-size:13.5px;font-weight:700;
                       cursor:pointer;box-shadow:0 4px 20px rgba(15,23,42,0.3);
                       display:flex;align-items:center;gap:8px;transition:all 0.15s"
                (mouseenter)="$any($event.target).style.boxShadow='0 8px 28px rgba(15,23,42,0.4)'"
                (mouseleave)="$any($event.target).style.boxShadow='0 4px 20px rgba(15,23,42,0.3)'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Plan a Tour
          <span style="background:rgba(245,158,11,0.25);color:#f59e0b;font-size:9.5px;
                       font-weight:800;padding:2px 6px;border-radius:99px;letter-spacing:0.05em">BETA SOON</span>
        </button>
      </div>

      <!-- Desktop selected popup -->
      <div *ngIf="selected" style="position:absolute;right:20px;bottom:28px;width:310px;
                                   background:white;border-radius:16px;z-index:20;overflow:hidden;
                                   border:2px solid var(--accent);animation:popIn 0.18s ease-out;
                                   box-shadow:0 8px 36px rgba(0,0,0,0.16)">
        <div style="position:relative">
          <div style="width:100%;height:110px;background:#eef1f6;display:flex;align-items:center;justify-content:center">
            <span style="font-size:11px;color:#9aaabb;font-family:monospace">photo — {{selected.title}}</span>
          </div>
          <button (click)="selected = null"
                  style="position:absolute;top:8px;right:8px;width:26px;height:26px;background:white;
                         border:none;border-radius:50%;cursor:pointer;display:flex;
                         align-items:center;justify-content:center;font-size:13px;
                         box-shadow:0 2px 8px rgba(0,0,0,0.15)">✕</button>
        </div>
        <div style="padding:12px 14px 14px">
          <div style="font-weight:700;font-size:14px;margin-bottom:3px;color:#0f172a">{{selected.title}}</div>
          <div style="font-size:11.5px;color:#94a3b8;margin-bottom:8px">📍 {{selected.city}}, {{selected.state}}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
            <app-tag-badge *ngFor="let t of selected.tags.slice(0,3)" [tag]="t.name" [small]="true"/>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <app-upvote-button [count]="selected.upvoteCount"
              [upvoted]="isUpvoted(selected.id)" size="sm"
              (toggled)="handleUpvote(selected.id)"/>
            <button (click)="viewDetails.emit(selected)"
                    style="background:#0f172a;color:white;border:none;padding:7px 14px;
                           border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer">
              View details
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter templates -->
    <ng-template #mobileFilters>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 12px 10px;
                  display:flex;gap:6px;scrollbar-width:none">
        <button *ngFor="let t of typeFilters" (click)="setTypeFilter(t.id)"
                [style.border-color]="activeType === t.id ? '#0f172a' : '#e2e8f0'"
                [style.background]="activeType === t.id ? '#0f172a' : 'white'"
                [style.color]="activeType === t.id ? 'white' : '#475569'"
                style="padding:6px 14px;border-radius:99px;font-size:12.5px;font-weight:600;
                       white-space:nowrap;cursor:pointer;border:1.5px solid;flex-shrink:0">
          {{t.label}}
        </button>
      </div>
    </ng-template>

    <ng-template #desktopFilters>
      <div style="background:white;border-bottom:1px solid #e9ecf0">
        <div style="padding:10px 14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button *ngFor="let t of typeFilters" (click)="setTypeFilter(t.id)"
                  [style.border-color]="activeType === t.id ? '#0f172a' : '#e2e8f0'"
                  [style.background]="activeType === t.id ? '#0f172a' : 'white'"
                  [style.color]="activeType === t.id ? 'white' : '#475569'"
                  style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;
                         cursor:pointer;border:1.5px solid;transition:all 0.12s">
            {{t.label}}
          </button>
          <div style="width:1px;height:20px;background:#e2e8f0;margin:0 2px"></div>
          <button (click)="tagsOpen = !tagsOpen"
                  [style.border-color]="activeTags.length ? 'var(--accent)' : '#e2e8f0'"
                  [style.background]="activeTags.length ? 'var(--accent-bg)' : 'white'"
                  [style.color]="activeTags.length ? 'var(--accent-dark)' : '#475569'"
                  style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;
                         cursor:pointer;border:1.5px solid;display:flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Tags{{activeTags.length ? ' · ' + activeTags.length : ''}}
          </button>
        </div>
        <div *ngIf="tagsOpen" style="padding:8px 14px 12px;border-top:1px solid #f1f5f9;
                                      display:flex;flex-wrap:wrap;gap:6px">
          <button *ngFor="let tag of allTags" (click)="toggleTag(tag)"
                  [style.border-color]="activeTags.includes(tag) ? 'var(--accent)' : '#e2e8f0'"
                  [style.background]="activeTags.includes(tag) ? 'var(--accent)' : '#f8fafc'"
                  [style.color]="activeTags.includes(tag) ? 'white' : '#475569'"
                  style="padding:4px 11px;border-radius:99px;font-size:11.5px;font-weight:600;
                         cursor:pointer;border:1.5px solid;transition:all 0.1s">
            {{tag}}
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('sheetEl') sheetEl!: ElementRef;

  @Input() user: User | null = null;
  @Input() upvotedIds: Set<number> = new Set();
  @Input() mapTiles = 'light';

  @Output() viewDetails = new EventEmitter<DisplaySummary>();
  @Output() needAuth = new EventEmitter<void>();
  @Output() upvoteToggle = new EventEmitter<number>();

  isMobile = window.innerWidth < 768;
  selected: DisplaySummary | null = null;
  activeType = 'all';
  searchQuery = '';
  activeTags: string[] = [];
  sortBy = 'popular';
  tagsOpen = false;
  snapKey: 'peek' | 'half' | 'full' = 'peek';
  snaps = SNAPS;
  snapKeys = Object.keys(SNAPS) as ('peek' | 'half' | 'full')[];
  allTags: string[] = [];
  availableTags: Tag[] = [];
  displays: DisplaySummary[] = [];
  loading = false;
  showTour = false;
  welcomeDismissed = localStorage.getItem('luminary_welcome_dismissed') === '1';

  typeFilters = [
    { id: 'all', label: 'All' },
    { id: 'DRIVE_BY', label: 'Drive-by' },
    { id: 'WALK_THROUGH', label: 'Walk-through' },
    { id: 'BOTH', label: 'Combined' },
  ];

  constructor(private displayApi: DisplayApiService) {}

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private markers: L.Marker[] = [];
  private resizeObserver?: ResizeObserver;

  // Touch drag state
  dragging = false;
  private dragStartY = 0;
  private dragStartSnap = SNAPS.peek;

  get filtered(): DisplaySummary[] {
    return this.displays.filter(d => {
      if (this.activeType !== 'all' && d.displayType !== this.activeType) return false;
      if (this.activeTags.length && !this.activeTags.every(t => d.tags.some(tag => tag.name === t))) return false;
      return true;
    }).sort((a, b) => this.sortBy === 'popular' ? b.upvoteCount - a.upvoteCount : b.id - a.id);
  }

  isUpvoted(id: number): boolean {
    return this.upvotedIds.has(id);
  }

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
    window.addEventListener('resize', this.onResize.bind(this));
    this.displayApi.getTags().subscribe(tags => {
      this.availableTags = tags;
      this.allTags = tags.map(t => t.name);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mapTiles'] && this.map && this.tileLayer) {
      const cfg = TILE_LAYERS[this.mapTiles] || TILE_LAYERS['light'];
      this.map.removeLayer(this.tileLayer);
      this.tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: 19 }).addTo(this.map);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.map?.remove();
  }

  private onResize() {
    this.isMobile = window.innerWidth < 768;
    this.map?.invalidateSize();
  }

  private initMap() {
    if (this.map || !this.mapContainer?.nativeElement) return;
    const cfg = TILE_LAYERS[this.mapTiles] || TILE_LAYERS['light'];
    this.map = L.map(this.mapContainer.nativeElement, { zoomControl: false }).setView([39.752, -104.979], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: 19 }).addTo(this.map);
    this.renderMarkers();
    this.map.on('click', () => { this.selected = null; });
    this.map.on('moveend', () => this.loadDisplays());
    this.map.invalidateSize();
    this.loadDisplays();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => this.map?.setView([pos.coords.latitude, pos.coords.longitude], 13),
        () => {},
      );
    }
  }

  private renderMarkers() {
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers = [];
    this.displays.forEach(display => {
      const tc = TYPE_COLORS[display.displayType] ?? TYPE_COLORS['DRIVE_BY'];
      const label = display.upvoteCount >= 1000
        ? (display.upvoteCount / 1000).toFixed(1) + 'k' : String(display.upvoteCount);
      const icon = L.divIcon({
        html: `<div style="width:42px;height:42px;border-radius:50%;background:${tc.dot};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.22);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;color:white;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:transform 0.15s">${label}</div>`,
        className: '', iconSize: [42, 42], iconAnchor: [21, 21],
      });
      const marker = L.marker([display.lat, display.lng], { icon })
        .addTo(this.map!)
        .on('click', (e: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(e);
          this.selectDisplay(display);
        });
      this.markers.push(marker);
    });
  }

  loadDisplays() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const tagIds = this.activeTags.map(name => this.availableTags.find(t => t.name === name)?.id).filter((id): id is number => !!id);
    this.loading = true;
    this.displayApi.search({
      lat: center.lat,
      lng: center.lng,
      radiusMiles: 10,
      displayType: this.activeType !== 'all' ? this.activeType : undefined,
      tags: tagIds.length ? tagIds : undefined,
    }).subscribe({
      next: page => {
        this.displays = page.content;
        this.loading = false;
        this.renderMarkers();
      },
      error: () => { this.loading = false; },
    });
  }

  selectDisplay(display: DisplaySummary) {
    this.selected = display;
    this.map?.panTo([display.lat, display.lng], { animate: true, duration: 0.4 } as any);
    if (this.isMobile) this.snapKey = 'half';
  }

  handleUpvote(id: number) {
    if (!this.user) { this.needAuth.emit(); return; }
    this.upvoteToggle.emit(id);
  }

  clearFilters() {
    this.activeTags = [];
    this.activeType = 'all';
    this.loadDisplays();
  }

  toggleTag(tag: string) {
    if (this.activeTags.includes(tag)) {
      this.activeTags = this.activeTags.filter(t => t !== tag);
    } else {
      this.activeTags = [...this.activeTags, tag];
    }
    this.loadDisplays();
  }

  setTypeFilter(type: string) {
    this.activeType = type;
    this.loadDisplays();
  }

  searchLocation() {
    const q = this.searchQuery.trim();
    if (!q) return;
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
      .then(r => r.json())
      .then((results: any[]) => {
        if (results.length > 0) {
          this.map?.setView([parseFloat(results[0].lat), parseFloat(results[0].lon)], 13);
        }
      });
  }

  dismissWelcome() {
    this.welcomeDismissed = true;
    localStorage.setItem('luminary_welcome_dismissed', '1');
  }

  onTouchStart(e: TouchEvent) {
    this.dragStartY = e.touches[0].clientY;
    this.dragStartSnap = SNAPS[this.snapKey];
    this.dragging = true;
  }

  onTouchMove(e: TouchEvent) {
    if (!this.dragging || !this.sheetEl) return;
    const dy = e.touches[0].clientY - this.dragStartY;
    const pct = this.dragStartSnap + (dy / window.innerHeight) * 100;
    const clamped = Math.max(SNAPS.full - 2, Math.min(98, pct));
    this.sheetEl.nativeElement.style.transform = `translateY(${clamped}%)`;
  }

  onTouchEnd(e: TouchEvent) {
    this.dragging = false;
    const dy = e.changedTouches[0].clientY - this.dragStartY;
    const pct = this.dragStartSnap + (dy / window.innerHeight) * 100;
    const vals = Object.entries(SNAPS) as [string, number][];
    const nearest = vals.reduce((best, cur) =>
      Math.abs(cur[1] - pct) < Math.abs(best[1] - pct) ? cur : best
    )[0] as 'peek' | 'half' | 'full';
    this.snapKey = nearest;
    if (this.sheetEl) this.sheetEl.nativeElement.style.transform = '';
  }
}
