import {
  Component, OnInit, OnDestroy, AfterViewInit, Input, Output, EventEmitter,
  ViewChild, ElementRef, signal, computed, effect, OnChanges, SimpleChanges, NgZone, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { TagBadgeComponent } from '../../shared/tag-badge/tag-badge.component';
import { UpvoteButtonComponent } from '../../shared/upvote-button/upvote-button.component';
import { User } from '../../models/listing.model';
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, Category, formatDateRange, isUpcoming, Tag, InitialFilters, FilterState } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';

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
  styles: [`@keyframes spin { to { transform: rotate(360deg); } }`],
  template: `
    <!-- Locating overlay -->
    <div *ngIf="locating" style="position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,0.6);
                display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
      <div style="width:52px;height:52px;border-radius:50%;border:4px solid rgba(255,255,255,0.2);
                  border-top-color:white;animation:spin 0.8s linear infinite"></div>
      <div style="color:white;font-size:16px;font-weight:700">Finding your location…</div>
      <button (click)="locating = false"
              style="color:rgba(255,255,255,0.6);background:none;border:none;font-size:13px;
                     cursor:pointer;margin-top:4px">Skip</button>
    </div>

    <!-- ── Mobile layout ── -->
    <div *ngIf="isMobile" style="position:fixed;top:58px;left:0;right:0;bottom:64px;z-index:1">
      <div #mapContainer style="position:absolute;inset:0"></div>

      <!-- Floating search bar -->
      <div style="position:absolute;top:10px;left:10px;right:10px;z-index:400;pointer-events:none">
        <div [style.border-color]="searchNotFound ? '#ef4444' : '#e2e8f0'"
             style="pointer-events:all;background:white;border-radius:12px;
                    box-shadow:0 4px 16px rgba(0,0,0,0.12);border:1px solid;
                    display:flex;align-items:center;padding:10px 14px;gap:8px;
                    transition:border-color 0.2s">
          <!-- spinner while searching, else search icon -->
          <div *ngIf="searching" style="width:15px;height:15px;border-radius:50%;flex-shrink:0;
                      border:2px solid #e2e8f0;border-top-color:#94a3b8;
                      animation:spin 0.7s linear infinite"></div>
          <svg *ngIf="!searching" width="15" height="15" viewBox="0 0 24 24" fill="none"
               [attr.stroke]="searchNotFound ? '#ef4444' : '#94a3b8'" stroke-width="2.5" style="flex-shrink:0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input [(ngModel)]="searchQuery"
                 (keydown.enter)="searchLocation()"
                 placeholder="Search by city or zip code…"
                 style="flex:1;border:none;outline:none;font-size:14px;color:#0f172a;background:transparent"/>
          <button (click)="locateMe()" title="Use my location"
                  style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;flex-shrink:0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Bottom sheet -->
      <div #sheetEl
           [style.transform]="dragging ? '' : 'translateY(' + snaps[snapKey] + '%)'"
           [style.transition]="dragging ? 'none' : 'transform 0.32s cubic-bezier(0.32,0.72,0,1)'"
           style="position:absolute;left:0;right:0;bottom:0;height:96%;z-index:500;
                  display:flex;flex-direction:column">
        <div style="background:white;border-radius:18px 18px 0 0;
                    box-shadow:0 -4px 24px rgba(0,0,0,0.12);flex:1;
                    display:flex;flex-direction:column;overflow:hidden">
          <!-- Handle -->
          <div #handleEl
               style="padding:10px 0 0;display:flex;flex-direction:column;
                      align-items:center;cursor:grab;flex-shrink:0">
            <div style="width:40px;height:4px;border-radius:99px;background:#cbd5e1;margin-bottom:8px"></div>
            <div style="width:100%;padding:0 16px 8px">
              <span style="font-size:13px;font-weight:700;color:#0f172a">
                {{filtered.length}} {{filtered.length === 1 ? 'listing' : 'listings'}}
              </span>
            </div>
            <!-- Category filter chips -->
            <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 12px 10px;
                        display:flex;gap:6px;scrollbar-width:none;width:100%;box-sizing:border-box">
              <button *ngFor="let cat of categoryOptions"
                      (click)="selectedCategory = cat.id; loadDisplays()"
                      [style.background]="selectedCategory === cat.id ? 'var(--accent)' : '#f1f5f9'"
                      [style.color]="selectedCategory === cat.id ? 'white' : '#374151'"
                      style="white-space:nowrap;border:none;padding:5px 12px;border-radius:20px;
                             font-size:12.5px;font-weight:600;cursor:pointer;flex-shrink:0">
                {{cat.label}}
              </button>
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
              <span [style.background]="categoryColors[selected.category]?.bg"
                    [style.color]="categoryColors[selected.category]?.text"
                    style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;display:inline-block;margin-bottom:4px">
                {{categoryLabels[selected.category]}}
              </span>
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
            <div *ngIf="searching" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);
                 width:13px;height:13px;border-radius:50%;pointer-events:none;
                 border:2px solid #e2e8f0;border-top-color:#94a3b8;
                 animation:spin 0.7s linear infinite"></div>
            <svg *ngIf="!searching" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none"
                 width="15" height="15" viewBox="0 0 24 24" fill="none"
                 [attr.stroke]="searchNotFound ? '#ef4444' : '#94a3b8'" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input [(ngModel)]="searchQuery"
                   (keydown.enter)="searchLocation()"
                   placeholder="Search by city or zip code…"
                   [style.border-color]="searchNotFound ? '#ef4444' : undefined"
                   style="width:100%;padding:9px 36px 9px 33px;border:1.5px solid #e2e8f0;
                          border-radius:9px;font-size:13px;outline:none;background:#f8fafc;
                          box-sizing:border-box;color:#0f172a;transition:border-color 0.2s"
                   (focus)="$any($event.target).style.borderColor='var(--accent)'"
                   (blur)="$any($event.target).style.borderColor=searchNotFound?'#ef4444':'#e2e8f0'"/>
            <button (click)="locateMe()" title="Use my location"
                    style="position:absolute;right:9px;top:50%;transform:translateY(-50%);
                           background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/>
              </svg>
            </button>
          </div>
        </div>
        <!-- Filter bar -->
        <ng-container *ngTemplateOutlet="desktopFilters"></ng-container>
        <!-- Count + sort -->
        <div style="padding:8px 14px;background:white;border-bottom:1px solid #e9ecf0;
                    display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:#94a3b8;font-weight:500">
            {{filtered.length}} {{filtered.length === 1 ? 'listing' : 'listings'}}
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
                <div style="font-weight:800;font-size:14px">Welcome to Event Mapster</div>
                <div style="font-size:12px;opacity:0.7;margin-top:1px">Your community event map</div>
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
              <div style="font-weight:800;font-size:16px;color:#0f172a;margin-bottom:6px">No listings found</div>
              <div style="font-size:13.5px;color:#64748b;line-height:1.6;max-width:280px;margin-bottom:20px">No listings match your current filters. Try broadening your search.</div>
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
          <span [style.background]="categoryColors[selected.category]?.bg"
                [style.color]="categoryColors[selected.category]?.text"
                style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;display:inline-block;margin-bottom:4px">
            {{categoryLabels[selected.category]}}
          </span>
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
    <ng-template #desktopFilters>
      <div style="background:white;border-bottom:1px solid #e9ecf0">
        <div style="padding:10px 14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button *ngFor="let cat of categoryOptions"
                  (click)="selectedCategory = cat.id; loadDisplays()"
                  [style.background]="selectedCategory === cat.id ? 'var(--accent)' : '#f1f5f9'"
                  [style.color]="selectedCategory === cat.id ? 'white' : '#374151'"
                  style="white-space:nowrap;border:none;padding:5px 12px;border-radius:20px;
                         font-size:12.5px;font-weight:600;cursor:pointer;flex-shrink:0">
            {{cat.label}}
          </button>
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
  @ViewChild('handleEl') handleEl!: ElementRef;

  @Input() user: User | null = null;
  @Input() upvotedIds: Set<number> = new Set();
  @Input() mapTiles = 'light';

  @Output() viewDetails = new EventEmitter<ListingSummary>();
  @Output() needAuth = new EventEmitter<void>();
  @Output() upvoteToggle = new EventEmitter<number>();
  @Input() initialFilters: InitialFilters | null = null;
  @Output() filtersChanged = new EventEmitter<FilterState>();

  isMobile = window.innerWidth < 768;
  selected: ListingSummary | null = null;
  searchQuery = '';
  activeTags: string[] = [];
  sortBy = 'popular';
  tagsOpen = false;
  snapKey: 'peek' | 'half' | 'full' = 'peek';
  snaps = SNAPS;
  allTags: string[] = [];
  availableTags: Tag[] = [];
  listings: ListingSummary[] = [];
  selectedCategory: Category | '' = '';
  radius = 10;
  categoryOptions: Array<{ id: Category | ''; label: string }> = [
    { id: '', label: 'All' },
    { id: 'CHRISTMAS_LIGHTS', label: 'Christmas Lights' },
    { id: 'YARD_SALE',        label: 'Yard Sales' },
    { id: 'ESTATE_SALE',      label: 'Estate Sales' },
    { id: 'POPUP_MARKET',     label: 'Pop-up Markets' },
    { id: 'FOOD_TRUCK',       label: 'Food Trucks' },
  ];
  categoryColors = CATEGORY_COLORS;
  categoryLabels = CATEGORY_LABELS;
  formatDateRange = formatDateRange;
  isUpcoming = isUpcoming;
  loading = false;
  showTour = false;
  welcomeDismissed = localStorage.getItem('hlp_welcome_dismissed') === '1';
  locating = !!navigator.geolocation && !sessionStorage.getItem('hlp_location_found');
  searching = false;
  searchNotFound = false;

  private listingApi = inject(ListingApiService);
  constructor(private zone: NgZone) {}

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private markers: L.Marker[] = [];
  private resizeObserver?: ResizeObserver;

  // Touch drag state
  dragging = false;
  private dragStartY = 0;
  private dragStartSnap = SNAPS.peek;

  get filtered(): ListingSummary[] {
    return this.listings.filter(d => {
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
    this.listingApi.getTags().subscribe(tags => {
      this.availableTags = tags;
      this.allTags = tags.map(t => t.name);
    });
    this.zone.runOutsideAngular(() => {
      const handle = this.handleEl.nativeElement;
      handle.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
      handle.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
      handle.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
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
    const f = this.initialFilters;
    const hasUrlLocation = f?.lat != null && f?.lng != null;

    if (f?.category) this.selectedCategory = f.category;
    if (f?.tags?.length) this.activeTags = [...f.tags];
    if (f?.radius != null) this.radius = f.radius;

    const initCenter: [number, number] = hasUrlLocation ? [f!.lat!, f!.lng!] : [39.752, -104.979];
    if (hasUrlLocation) this.locating = false;

    this.map = L.map(this.mapContainer.nativeElement, { zoomControl: false }).setView(initCenter, 13);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: 19 }).addTo(this.map);
    this.renderMarkers();
    this.map.on('click', () => { this.selected = null; if (this.isMobile) this.snapKey = 'peek'; });
    this.map.invalidateSize();
    this.loadDisplays();
    this.map.on('moveend', () => this.loadDisplays());
    if (!hasUrlLocation && navigator.geolocation) {
      const cached = sessionStorage.getItem('hlp_location_found');
      if (cached) {
        const [lat, lng] = cached.split(',').map(Number);
        this.map?.setView([lat, lng], 13);
      } else {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude, longitude } = pos.coords;
            sessionStorage.setItem('hlp_location_found', `${latitude},${longitude}`);
            this.map?.setView([latitude, longitude], 13);
            this.locating = false;
          },
          () => { this.locating = false; },
          { timeout: 15000, maximumAge: 60000 }
        );
      }
    }
  }

  private renderMarkers() {
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers = [];
    this.listings.forEach(listing => {
      const color = CATEGORY_COLORS[listing.category]?.marker ?? '#64748b';
      const label = listing.upvoteCount >= 1000
        ? (listing.upvoteCount / 1000).toFixed(1) + 'k' : String(listing.upvoteCount);
      const icon = L.divIcon({
        html: `<div style="width:42px;height:42px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.22);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;color:white;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:transform 0.15s">${label}</div>`,
        className: '', iconSize: [42, 42], iconAnchor: [21, 21],
      });
      const marker = L.marker([listing.lat, listing.lng], { icon })
        .addTo(this.map!)
        .on('click', (e: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(e);
          this.selectDisplay(listing);
        });
      this.markers.push(marker);
    });
  }

  private emitFiltersChanged() {
    if (!this.map) return;
    const center = this.map.getCenter();
    this.filtersChanged.emit({
      category: this.selectedCategory,
      tags: [...this.activeTags],
      lat: center.lat,
      lng: center.lng,
      radius: this.radius,
    });
  }

  loadDisplays() {
    if (!this.map) return;
    this.emitFiltersChanged();
    const center = this.map.getCenter();
    const tagIds = this.activeTags.map(name => this.availableTags.find(t => t.name === name)?.id).filter((id): id is number => !!id);
    this.loading = true;
    this.listingApi.search({
      lat: center.lat,
      lng: center.lng,
      radiusMiles: this.radius,
      category: this.selectedCategory || undefined,
      tags: tagIds.length ? tagIds : undefined,
    }).subscribe({
      next: page => {
        this.listings = page.content;
        this.loading = false;
        this.renderMarkers();
      },
      error: () => { this.loading = false; },
    });
  }

  selectDisplay(display: ListingSummary) {
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
    this.selectedCategory = '';
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

  locateMe() {
    if (!navigator.geolocation) return;
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        sessionStorage.setItem('hlp_location_found', `${latitude},${longitude}`);
        this.map?.setView([latitude, longitude], 13);
        this.locating = false;
      },
      () => { this.locating = false; },
      { timeout: 15000, maximumAge: 0 }
    );
  }

  searchLocation() {
    const q = this.searchQuery.trim();
    if (!q || this.searching) return;
    this.searching = true;
    this.searchNotFound = false;
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
      .then(r => r.json())
      .then((results: any[]) => {
        this.searching = false;
        if (results.length > 0) {
          this.map?.setView([parseFloat(results[0].lat), parseFloat(results[0].lon)], 13);
        } else {
          this.searchNotFound = true;
          setTimeout(() => { this.searchNotFound = false; }, 2500);
        }
      })
      .catch(() => {
        this.searching = false;
        this.searchNotFound = true;
        setTimeout(() => { this.searchNotFound = false; }, 2500);
      });
  }

  dismissWelcome() {
    this.welcomeDismissed = true;
    localStorage.setItem('hlp_welcome_dismissed', '1');
  }

  onTouchStart(e: TouchEvent) {
    this.dragStartY = e.touches[0].clientY;
    this.dragStartSnap = SNAPS[this.snapKey];
    this.dragging = true;
    if (this.sheetEl) this.sheetEl.nativeElement.style.transition = 'none';
  }

  onTouchMove(e: TouchEvent) {
    if (!this.dragging || !this.sheetEl) return;
    e.preventDefault();
    const dy = e.touches[0].clientY - this.dragStartY;
    const pct = this.dragStartSnap + (dy / window.innerHeight) * 100;
    const clamped = Math.max(SNAPS.full - 2, Math.min(98, pct));
    this.sheetEl.nativeElement.style.transform = `translateY(${clamped}%)`;
  }

  onTouchEnd(e: TouchEvent) {
    if (!this.dragging) return;
    this.dragging = false;
    const dy = e.changedTouches[0].clientY - this.dragStartY;
    const pct = this.dragStartSnap + (dy / window.innerHeight) * 100;
    const vals = Object.entries(SNAPS) as [string, number][];
    const nearest = vals.reduce((best, cur) =>
      Math.abs(cur[1] - pct) < Math.abs(best[1] - pct) ? cur : best
    )[0] as 'peek' | 'half' | 'full';
    if (this.sheetEl) {
      this.sheetEl.nativeElement.style.transition = 'transform 0.32s cubic-bezier(0.32,0.72,0,1)';
      this.sheetEl.nativeElement.style.transform = `translateY(${SNAPS[nearest]}%)`;
    }
    this.zone.run(() => {
      this.snapKey = nearest;
    });
  }
}
