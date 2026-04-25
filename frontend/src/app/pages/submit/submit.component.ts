import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CATEGORY_LABELS, Category, Tag, Photo, Listing, ListingSummary, HostEntity, UpdateListingRequest } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
import { TagBadgeComponent } from '../../shared/tag-badge/tag-badge.component';

@Component({
  selector: 'app-submit',
  standalone: true,
  imports: [CommonModule, FormsModule, TagBadgeComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:560px;margin:0 auto;padding:28px 20px 0">

        <!-- Confirmed screen -->
        <div *ngIf="step() === 'done'" style="text-align:center;padding:60px 0">
          <div style="width:72px;height:72px;border-radius:50%;
                      background:linear-gradient(135deg,var(--accent),#22c55e);
                      margin:0 auto 20px;display:flex;align-items:center;justify-content:center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style="font-weight:800;font-size:24px;color:#0f172a;margin-bottom:10px">
            {{editListing ? 'Listing Updated!' : 'Listing Submitted!'}}
          </div>
          <div style="font-size:15px;color:#64748b;line-height:1.6;max-width:340px;margin:0 auto 32px">
            Your listing is now live on the community board!
          </div>
          <button (click)="goHome.emit()"
                  style="background:var(--accent);color:white;border:none;padding:13px 32px;
                         border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">
            Back to Map
          </button>
        </div>

        <!-- Form -->
        <div *ngIf="step() !== 'done'">
          <!-- Header -->
          <div style="margin-bottom:28px">
            <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">
              {{editListing ? 'Edit Listing' : 'Add a Listing'}}
            </div>
            <div style="font-size:13.5px;color:#64748b">Share an event or attraction with the community</div>
          </div>

          <!-- Step indicator -->
          <div style="display:flex;gap:8px;margin-bottom:28px">
            <div *ngFor="let s of steps; let i = index"
                 [style.background]="getStepIndex() >= i ? 'var(--accent)' : '#e2e8f0'"
                 style="height:4px;flex:1;border-radius:2px;transition:background 0.2s"></div>
          </div>

          <!-- Step 1: Location -->
          <div *ngIf="step() === 'location'">
            <div style="font-weight:700;font-size:16px;color:#0f172a;margin-bottom:16px">
              1 of 3 — Location
            </div>
            <div style="display:flex;flex-direction:column;gap:14px">
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
                  Street Address *
                </label>
                <div style="position:relative">
                  <input [(ngModel)]="form.address" placeholder="123 Main St"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'; dismissAddressSuggestions()"
                         (input)="onAddressInput()"/>
                  <div *ngIf="showAddressSuggestions"
                       style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;
                              background:white;border:1.5px solid #e2e8f0;border-radius:10px;
                              box-shadow:0 4px 20px rgba(0,0,0,0.12);overflow:hidden">
                    <button *ngFor="let s of addressSuggestions; let last = last"
                            (mousedown)="selectAddressSuggestion(s)"
                            [style.border-bottom]="last ? 'none' : '1px solid #f1f5f9'"
                            style="display:block;width:100%;text-align:left;padding:10px 14px;
                                   background:none;border-left:none;border-right:none;border-top:none;
                                   cursor:pointer;font-size:13.5px;color:#0f172a;transition:background 0.1s"
                            (mouseover)="$any($event.target).style.background='#f8fafc'"
                            (mouseout)="$any($event.target).style.background='none'">
                      {{formatAddressSuggestion(s)}}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Map placeholder -->
              <div style="width:100%;height:200px;background:#e5e7eb;border-radius:12px;
                          display:flex;align-items:center;justify-content:center;
                          border:1.5px dashed #d1d5db">
                <div style="text-align:center;color:#9ca3af">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  <div style="font-size:12.5px">Tap to pin location</div>
                </div>
              </div>

              <div style="display:flex;gap:12px">
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">City *</label>
                  <input [(ngModel)]="form.city" placeholder="Springfield"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
                </div>
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">State *</label>
                  <input [(ngModel)]="form.state" placeholder="IL"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
                </div>
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">ZIP</label>
                  <input [(ngModel)]="form.postcode" placeholder="80205"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
                </div>
              </div>
            </div>
            <div *ngIf="editListing" style="margin-top:8px;text-align:center">
              <button (click)="cancel.emit()"
                      style="background:none;border:none;color:#94a3b8;font-size:13px;
                             cursor:pointer;text-decoration:underline">
                Cancel editing
              </button>
            </div>
          </div>

          <!-- Step 2: Details -->
          <div *ngIf="step() === 'details'">
            <div style="font-weight:700;font-size:16px;color:#0f172a;margin-bottom:16px">
              2 of 3 — Details
            </div>
            <div style="display:flex;flex-direction:column;gap:14px">
              <!-- Category picker -->
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Category *</label>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <button *ngFor="let cat of categoryOptions"
                          (click)="form.category = cat.id"
                          [style.border]="form.category === cat.id ? '2px solid var(--accent)' : '2px solid #e2e8f0'"
                          [style.background]="form.category === cat.id ? 'var(--accent-bg)' : 'white'"
                          style="padding:10px 14px;border-radius:10px;text-align:left;cursor:pointer;
                                 font-size:13.5px;font-weight:500;color:#0f172a;transition:all 0.1s">
                    {{cat.label}}
                  </button>
                </div>
              </div>
              <!-- Post as (only shown when user has hosts) -->
              <div *ngIf="user && hosts().length > 0">
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
                  Post as
                </label>
                <select [ngModel]="selectedHostId()"
                        (ngModelChange)="selectedHostId.set($event === 'null' ? null : +$event)"
                        style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                               font-size:13px;color:#0f172a;background:white;box-sizing:border-box">
                  <option [ngValue]="null">Personal</option>
                  <option *ngFor="let h of hosts()" [ngValue]="h.id">{{h.displayName}}</option>
                </select>
              </div>
              <!-- Title -->
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Title *</label>
                <input [(ngModel)]="form.title" placeholder="The Johnson Family Christmas Spectacular"
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                       (focus)="$any($event.target).style.borderColor='var(--accent)'"
                       (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
              </div>
              <!-- Description -->
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Description</label>
                <textarea [(ngModel)]="form.description" rows="3"
                          placeholder="Tell visitors what to expect…"
                          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                 font-size:14px;color:#0f172a;background:white;box-sizing:border-box;
                                 resize:none;font-family:inherit;outline:none"
                          (focus)="$any($event.target).style.borderColor='var(--accent)'"
                          (blur)="$any($event.target).style.borderColor='#e2e8f0'"></textarea>
              </div>
              <!-- Start / End dates -->
              <div style="display:flex;gap:12px">
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Start *</label>
                  <input type="datetime-local" [(ngModel)]="form.startDatetime"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:13px;color:#0f172a;background:white;box-sizing:border-box"/>
                </div>
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">End {{form.category !== 'YARD_SALE' ? '*' : '(optional)'}}</label>
                  <input type="datetime-local" [(ngModel)]="form.endDatetime"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:13px;color:#0f172a;background:white;box-sizing:border-box"/>
                </div>
              </div>
              <!-- Price -->
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Price (optional)</label>
                <input [(ngModel)]="form.priceInfo" placeholder="e.g. Free, $8 admission"
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"/>
              </div>
              <!-- Christmas Lights only -->
              <ng-container *ngIf="isLights">
                <div>
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Type *</label>
                  <div style="display:flex;flex-wrap:wrap;gap:8px">
                    <button *ngFor="let t of types" (click)="form.displayType = t[0]"
                            [style.background]="form.displayType === t[0] ? 'var(--accent)' : 'white'"
                            [style.color]="form.displayType === t[0] ? 'white' : '#374151'"
                            [style.border-color]="form.displayType === t[0] ? 'var(--accent)' : '#e2e8f0'"
                            style="padding:7px 14px;border:1.5px solid;border-radius:99px;font-size:13px;
                                   font-weight:600;cursor:pointer;transition:all 0.15s">
                      {{t[1]}}
                    </button>
                  </div>
                </div>
                <div>
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Best Viewing Time</label>
                  <input [(ngModel)]="form.bestTime" placeholder="Nightly 5pm–11pm"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
                </div>
                <div>
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Tags</label>
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    <button *ngFor="let tag of allTags" (click)="toggleTag(tag)"
                            [style.opacity]="isTagSelected(tag) ? '1' : '0.5'"
                            style="background:none;border:none;cursor:pointer;padding:0;transition:opacity 0.15s">
                      <app-tag-badge [tag]="tag" [small]="true"/>
                    </button>
                  </div>
                </div>
              </ng-container>
              <!-- Food Truck -->
              <div *ngIf="isFoodTruck">
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Cuisine Type</label>
                <input [(ngModel)]="form.cuisineType" placeholder="e.g. Mexican, BBQ, Thai"
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"/>
              </div>
              <!-- Estate Sale -->
              <div *ngIf="isEstateSale">
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Organizer</label>
                <input [(ngModel)]="form.organizer" placeholder="e.g. Estate Professionals Inc."
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"/>
              </div>
              <!-- Website — Christmas Lights + Food Truck -->
              <div *ngIf="showWebsite">
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Website (optional)</label>
                <input [(ngModel)]="form.websiteUrl" placeholder="https://..."
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"/>
              </div>
              <!-- Host name override (all categories) -->
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
                  Host name for this listing
                  <span style="font-weight:400;color:#94a3b8">(optional — overrides your profile name)</span>
                </label>
                <input [(ngModel)]="form.hostName" placeholder="Leave blank to use your profile name"
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                       (focus)="$any($event.target).style.borderColor='var(--accent)'"
                       (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
              </div>
            </div>
          </div>

          <!-- Step 3: Photo -->
          <div *ngIf="step() === 'photo'">
            <div style="font-weight:700;font-size:16px;color:#0f172a;margin-bottom:16px">
              3 of 3 — Add a Photo (optional)
            </div>
            <!-- Existing photos (edit mode) -->
            <div *ngIf="existingPhotos().length > 0" style="margin-bottom:16px">
              <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">
                Current Photos
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <div *ngFor="let p of existingPhotos()" style="position:relative">
                  <img [src]="p.url"
                       style="width:80px;height:80px;object-fit:cover;border-radius:8px;display:block"/>
                  <button (click)="removeExistingPhoto(p.id)"
                          style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;
                                 background:#dc2626;color:white;border:none;border-radius:50%;
                                 cursor:pointer;font-size:13px;line-height:1;display:flex;
                                 align-items:center;justify-content:center">
                    ×
                  </button>
                </div>
              </div>
              <div *ngIf="photoError" style="color:#dc2626;font-size:12px;margin-top:6px">
                {{photoError}}
              </div>
            </div>
            <div style="border:2px dashed #d1d5db;border-radius:16px;padding:48px 24px;
                        text-align:center;background:white;cursor:pointer"
                 (click)="photoInput.click()"
                 (dragover)="$event.preventDefault()"
                 (drop)="onDrop($event)">
              <div *ngIf="!photoPreview">
                <div style="width:56px;height:56px;border-radius:14px;background:#f1f5f9;
                            margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <div style="font-weight:600;color:#374151;margin-bottom:4px">Drop a photo or click to upload</div>
                <div style="font-size:12.5px;color:#94a3b8">JPEG or PNG, max 10 MB</div>
              </div>
              <div *ngIf="photoPreview">
                <img [src]="photoPreview" style="max-width:100%;max-height:260px;border-radius:10px;object-fit:cover"/>
                <div style="font-size:12px;color:#94a3b8;margin-top:10px">Click to change</div>
              </div>
            </div>
            <input #photoInput type="file" accept="image/*" style="display:none" (change)="onFileChange($event)"/>
          </div>

          <!-- Navigation -->
          <div *ngIf="error" style="color:#dc2626;font-size:13px;padding:8px 0">{{error}}</div>
          <div style="display:flex;gap:12px;margin-top:28px">
            <button *ngIf="step() !== 'location'" (click)="prevStep()"
                    style="flex:1;padding:13px;border-radius:12px;font-size:15px;font-weight:600;
                           background:none;border:1.5px solid #e2e8f0;color:#374151;cursor:pointer">
              Back
            </button>
            <button (click)="nextStep()"
                    [disabled]="!canAdvance() || geocoding || submitting"
                    [style.opacity]="(canAdvance() && !geocoding && !submitting) ? '1' : '0.5'"
                    style="flex:2;padding:13px;border-radius:12px;font-size:15px;font-weight:700;
                           background:var(--accent);color:white;border:none;cursor:pointer">
              {{step() === 'photo' ? 'Done' : step() === 'details' ? (submitting ? (editListing ? 'Updating…' : 'Submitting…') : (editListing ? 'Update & Continue' : 'Submit & Continue')) : (geocoding ? 'Locating…' : 'Continue')}}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SubmitComponent implements OnInit {
  @Input() user: any = null;
  @Output() goHome = new EventEmitter<void>();

  private listingApi = inject(ListingApiService);

  step = signal<'location' | 'details' | 'photo' | 'done'>('location');
  steps = ['location', 'details', 'photo'];
  availableTags: Tag[] = [];
  allTags: string[] = [];
  photoFile: File | null = null;
  photoPreview: string | null = null;
  submitting = false;
  geocoding = false;
  error: string | null = null;
  createdListingId = signal<number | null>(null);
  @Input() editListing: ListingSummary | null = null;
  @Input() adminEdit = false;
  @Output() cancel = new EventEmitter<void>();

  existingPhotos = signal<Photo[]>([]);
  photoError: string | null = null;

  hosts = signal<HostEntity[]>([]);
  selectedHostId = signal<number | null>(null);

  addressSuggestions: any[] = [];
  showAddressSuggestions = false;
  private suggestTimer: any = null;

  categoryOptions: Array<{ id: Category; label: string }> = [
    { id: 'CHRISTMAS_LIGHTS', label: '🎄 Christmas Lights' },
    { id: 'YARD_SALE',        label: '🏷️ Yard / Garage Sale' },
    { id: 'ESTATE_SALE',      label: '🏠 Estate Sale' },
    { id: 'POPUP_MARKET',     label: '🛍️ Pop-up Market' },
    { id: 'FOOD_TRUCK',       label: '🚚 Food Truck' },
  ];

  types: [string, string][] = [
    ['DRIVE_BY', 'Drive-by'],
    ['WALK_THROUGH', 'Walk-through'],
    ['BOTH', 'Drive-by & Walk-through'],
  ];

  form = {
    category: '' as Category | '',
    address: '', city: '', state: '', postcode: '',
    lat: 0, lng: 0,
    title: '', description: '',
    startDatetime: '', endDatetime: '',
    priceInfo: '',
    displayType: 'DRIVE_BY', bestTime: '', tagIds: [] as number[],
    cuisineType: '',
    organizer: '',
    websiteUrl: '',
    hostName: '',
  };

  get isLights() { return this.form.category === 'CHRISTMAS_LIGHTS'; }
  get isFoodTruck() { return this.form.category === 'FOOD_TRUCK'; }
  get isEstateSale() { return this.form.category === 'ESTATE_SALE'; }
  get showWebsite() { return this.isLights || this.isFoodTruck; }

  constructor() {
    this.listingApi.getTags().subscribe(tags => {
      this.availableTags = tags;
      this.allTags = tags.map(t => t.name);
    });
  }

  private toDatetimeLocal(dt: string | null): string {
    return dt ? dt.substring(0, 16) : '';
  }

  ngOnInit() {
    if (this.user) {
      this.listingApi.getMyHosts().subscribe({
        next: h => {
          this.hosts.set(h);
          if (h.length > 0 && this.selectedHostId() === null) {
            this.selectedHostId.set(h[0].id);
          }
        },
        error: () => {},
      });
    }

    if (this.editListing) {
      const d = this.editListing;
      this.form.category = d.category;
      this.form.title = d.title;
      this.form.description = '';
      this.form.city = d.city;
      this.form.state = d.state;
      this.form.lat = d.lat;
      this.form.lng = d.lng;
      this.form.startDatetime = this.toDatetimeLocal(d.startDatetime);
      this.form.endDatetime = this.toDatetimeLocal(d.endDatetime);
      this.form.priceInfo = d.priceInfo ?? '';
      this.form.displayType = d.displayType ?? 'DRIVE_BY';
      this.form.cuisineType = d.cuisineType ?? '';
      this.form.organizer = d.organizer ?? '';
      this.form.websiteUrl = d.websiteUrl ?? '';
      this.form.hostName = d.resolvedHostName ?? '';
      this.form.tagIds = d.tags.map(t => t.id);

      this.listingApi.getById(d.id).subscribe({
        next: (full: Listing) => {
          this.form.description = full.description ?? '';
          this.form.address = full.address ?? '';
          this.form.postcode = full.postcode ?? '';
          this.form.bestTime = full.bestTime ?? '';
          this.existingPhotos.set(full.photos ?? []);
          this.createdListingId.set(d.id);
        },
        error: () => {
          this.error = 'Could not load listing details. Some fields may be incomplete.';
          this.createdListingId.set(d.id);
        },
      });
    }
  }

  getStepIndex() {
    return this.steps.indexOf(this.step() as any);
  }

  toggleTag(tagName: string) {
    const tag = this.availableTags.find(t => t.name === tagName);
    if (!tag) return;
    const idx = this.form.tagIds.indexOf(tag.id);
    if (idx > -1) this.form.tagIds.splice(idx, 1);
    else this.form.tagIds.push(tag.id);
  }

  isTagSelected(tagName: string) {
    const tag = this.availableTags.find(t => t.name === tagName);
    return tag ? this.form.tagIds.includes(tag.id) : false;
  }

  onAddressInput() {
    const q = this.form.address.trim();
    clearTimeout(this.suggestTimer);
    if (q.length < 3) { this.addressSuggestions = []; this.showAddressSuggestions = false; return; }
    this.suggestTimer = setTimeout(() => this.fetchAddressSuggestions(q), 350);
  }

  private fetchAddressSuggestions(q: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&countrycodes=us`;
    fetch(url)
      .then(r => r.json())
      .then((results: any[]) => {
        if (this.form.address.trim().length >= 3) {
          this.addressSuggestions = results;
          this.showAddressSuggestions = results.length > 0;
        }
      })
      .catch(() => {});
  }

  selectAddressSuggestion(s: any) {
    const a = s.address;
    this.form.address = [a.house_number, a.road].filter(Boolean).join(' ');
    this.form.city = a.city ?? a.town ?? a.village ?? a.hamlet ?? '';
    this.form.state = a.state ?? '';
    this.form.postcode = a.postcode ?? '';
    this.form.lat = parseFloat(s.lat);
    this.form.lng = parseFloat(s.lon);
    this.showAddressSuggestions = false;
    this.addressSuggestions = [];
  }

  dismissAddressSuggestions() {
    setTimeout(() => { this.showAddressSuggestions = false; }, 150);
  }

  formatAddressSuggestion(s: any): string {
    const a = s.address;
    return [
      [a.house_number, a.road].filter(Boolean).join(' '),
      a.city ?? a.town ?? a.village ?? a.hamlet ?? '',
      a.state ?? '',
    ].filter(Boolean).join(', ');
  }

  removeExistingPhoto(photoId: number) {
    const listingId = this.createdListingId()!;
    const snapshot = this.existingPhotos();
    this.existingPhotos.update(photos => photos.filter(p => p.id !== photoId));
    this.listingApi.deletePhoto(listingId, photoId).subscribe({
      next: () => { this.photoError = null; },
      error: () => {
        this.existingPhotos.set(snapshot);
        this.photoError = 'Could not remove photo. Try again.';
      },
    });
  }

  canAdvance() {
    if (this.step() === 'location') return this.form.address.trim() && this.form.city.trim();
    if (this.step() === 'details') return this.form.title.trim() && this.form.category && this.form.startDatetime && (this.form.category === 'YARD_SALE' || this.form.endDatetime);
    return true;
  }

  prevStep() {
    if (this.step() === 'details') this.step.set('location');
    else if (this.step() === 'photo') this.step.set('details');
  }

  nextStep() {
    if (this.step() === 'location') {
      this.geocodeAndAdvance();
    } else if (this.step() === 'details') {
      this.submitListing();
    } else if (this.step() === 'photo') {
      if (this.photoFile && this.createdListingId()) {
        this.listingApi.uploadPhoto(this.createdListingId()!, this.photoFile).subscribe({
          complete: () => { this.step.set('done'); },
          error: () => { this.step.set('done'); },
        });
      } else {
        this.step.set('done');
      }
    }
  }

  private geocodeAndAdvance() {
    this.error = null;
    this.geocoding = true;
    const query = encodeURIComponent(`${this.form.address}, ${this.form.city}, ${this.form.state} ${this.form.postcode}`.trim());
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
      .then(r => r.json())
      .then((results: any[]) => {
        this.geocoding = false;
        if (results.length > 0) {
          this.form.lat = parseFloat(results[0].lat);
          this.form.lng = parseFloat(results[0].lon);
          this.step.set('details');
        } else {
          this.error = 'Could not find that address. Try adding more detail (e.g. full street number, city, state).';
        }
      })
      .catch(() => {
        this.geocoding = false;
        this.error = 'Could not reach the geocoding service. Check your connection and try again.';
      });
  }

  private submitListing() {
    this.submitting = true;
    this.error = null;

    const payload = {
      category: this.form.category as Category,
      title: this.form.title,
      description: this.form.description,
      address: this.form.address,
      city: this.form.city,
      state: this.form.state,
      postcode: this.form.postcode,
      lat: this.form.lat,
      lng: this.form.lng,
      startDatetime: this.form.startDatetime,
      endDatetime: this.form.endDatetime,
      priceInfo: this.form.priceInfo,
      bestTime: this.form.bestTime,
      displayType: this.form.displayType,
      tagIds: this.form.tagIds,
      cuisineType: this.form.cuisineType,
      organizer: this.form.organizer,
      websiteUrl: this.form.websiteUrl,
      hostName: this.form.hostName,
      hostId: this.selectedHostId(),
    };

    const call = this.adminEdit && this.editListing
      ? this.listingApi.adminUpdateListing(this.editListing.id, payload as UpdateListingRequest)
      : this.editListing
        ? this.listingApi.update(this.editListing.id, payload as UpdateListingRequest)
        : this.listingApi.create(payload);

    call.subscribe({
      next: listing => {
        this.createdListingId.set(listing.id);
        this.submitting = false;
        this.step.set('photo');
      },
      error: () => {
        this.submitting = false;
        this.error = this.editListing ? 'Update failed. Please try again.' : 'Submission failed. Please try again.';
      },
    });
  }

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) { this.photoFile = file; this.readFile(file); }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) { this.photoFile = file; this.readFile(file); }
  }

  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => this.photoPreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }
}
