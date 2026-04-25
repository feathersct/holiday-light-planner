import { Component, OnInit, signal, computed, effect, HostListener, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListingSummary, HostUser, InitialFilters, FilterState, Category, CATEGORY_LABELS } from './models/listing.model';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { BottomTabBarComponent } from './shared/bottom-tab-bar/bottom-tab-bar.component';
import { SignInModalComponent } from './shared/sign-in-modal/sign-in-modal.component';
import { DisplayDetailComponent } from './shared/display-detail/display-detail.component';
import { MapComponent } from './pages/map/map.component';
import { SubmitComponent } from './pages/submit/submit.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AdminComponent } from './pages/admin/admin.component';
import { HostProfileComponent } from './pages/host-profile/host-profile.component';
import { HostSearchComponent } from './pages/host-search/host-search.component';
import { AuthService } from './services/auth.service';
import { UpvoteService } from './services/upvote.service';
import { ListingApiService } from './services/listing-api.service';

type Screen = 'map' | 'submit' | 'profile' | 'admin' | 'host' | 'hosts';

const ACCENT_OPTIONS = [
  { id: 'amber',  label: 'Warm Amber',  color: '#f59e0b' },
  { id: 'teal',   label: 'Icy Teal',    color: '#0d9488' },
  { id: 'coral',  label: 'Holly Red',   color: '#ef4444' },
];

const TILE_OPTIONS = [
  { id: 'light',    label: 'Light' },
  { id: 'standard', label: 'Standard' },
  { id: 'dark',     label: 'Dark' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    NavbarComponent, BottomTabBarComponent,
    SignInModalComponent, DisplayDetailComponent,
    MapComponent, SubmitComponent, ProfileComponent, AdminComponent, HostProfileComponent, HostSearchComponent,
  ],
  template: `
    <!-- Navbar -->
    <app-navbar [currentScreen]="screen()" [user]="authService.currentUser()" [isMobile]="isMobile"
      (navigate)="navigate($event)" (authAction)="onAuthAction()"/>

    <!-- Main content area (below 58px navbar, above 64px tab bar on mobile) -->
    <div [style.padding-top]="'58px'"
         [style.padding-bottom]="isMobile ? '64px' : '0'"
         style="height:100vh;box-sizing:border-box;overflow:hidden">

      <app-map *ngIf="screen() === 'map'"
        [user]="authService.currentUser()"
        [mapTiles]="authService.mapTiles()"
        [initialFilters]="initialFilters"
        style="display:block;height:100%"
        (needAuth)="showSignIn.set(true)"
        (viewDetails)="openDetail($event)"
        (upvoteToggle)="upvoteService.toggle($event)"
        (filtersChanged)="onFiltersChanged($event)"/>

      <app-submit *ngIf="screen() === 'submit'"
        [user]="authService.currentUser()"
        [editListing]="editingListing()"
        [adminEdit]="editSource() === 'admin'"
        style="display:block;height:100%"
        (goHome)="onSubmitDone()"
        (cancel)="onSubmitCancel()"/>

      <app-profile *ngIf="screen() === 'profile'"
        [user]="authService.currentUser()"
        style="display:block;height:100%"
        (selectDisplay)="openDetail($event)"/>

      <app-admin *ngIf="screen() === 'admin'"
        style="display:block;height:100%"
        (editListing)="onAdminEditListing($event)"/>

      <app-host-profile *ngIf="screen() === 'host' && viewingHost()"
        [host]="viewingHost()!"
        style="display:block;height:100%"
        (back)="navigate('map')"
        (viewDetails)="openDetail($event)"/>

      <app-host-search *ngIf="screen() === 'hosts'"
        style="display:block;height:100%"
        (viewHost)="openHostProfile($event)"/>
    </div>

    <!-- Mobile bottom tab bar -->
    <app-bottom-tab-bar *ngIf="isMobile"
      [currentScreen]="screen()" [user]="authService.currentUser()"
      (navigate)="navigate($event)"/>

    <!-- Sign-in modal -->
    <app-sign-in-modal *ngIf="showSignIn()"
      (close)="showSignIn.set(false)"
      (signIn)="signIn()"/>

    <!-- Display detail modal -->
    <app-display-detail *ngIf="selectedDisplay()"
      [summary]="selectedDisplay()!"
      [upvoted]="isUpvoted(selectedDisplay()!.id)"
      [isMobile]="isMobile"
      (close)="selectedDisplay.set(null)"
      (upvote)="upvoteService.toggle(selectedDisplay()!.id)"
      (viewHost)="openHostProfile($event)"
      (report)="selectedDisplay.set(null)"/>

    <!-- Settings panel toggle (bottom-right FAB on desktop) -->
    <button *ngIf="!isMobile" (click)="showSettings.set(!showSettings())"
            style="position:fixed;bottom:24px;right:24px;z-index:1800;
                   width:44px;height:44px;border-radius:50%;background:#0f172a;
                   border:none;cursor:pointer;display:flex;align-items:center;
                   justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    </button>

    <!-- Settings panel -->
    <div *ngIf="showSettings()"
         style="position:fixed;bottom:80px;right:24px;z-index:1900;
                background:white;border-radius:16px;padding:20px;width:240px;
                box-shadow:0 8px 32px rgba(0,0,0,0.15);border:1px solid #e2e8f0">
      <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:14px">
        Appearance
      </div>

      <div style="font-size:11.5px;font-weight:600;color:#94a3b8;text-transform:uppercase;
                  letter-spacing:0.6px;margin-bottom:8px">Accent Color</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button *ngFor="let a of accentOptions" (click)="setAccent(a.id)"
                [style.background]="a.color"
                [style.box-shadow]="authService.accentColor() === a.id ? '0 0 0 3px white, 0 0 0 5px ' + a.color : 'none'"
                style="width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;
                       transition:box-shadow 0.15s" [title]="a.label">
        </button>
      </div>

      <div style="font-size:11.5px;font-weight:600;color:#94a3b8;text-transform:uppercase;
                  letter-spacing:0.6px;margin-bottom:8px">Map Style</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button *ngFor="let t of tileOptions" (click)="setTiles(t.id)"
                [style.background]="authService.mapTiles() === t.id ? 'var(--accent-bg)' : 'none'"
                [style.color]="authService.mapTiles() === t.id ? 'var(--accent-dark)' : '#374151'"
                [style.font-weight]="authService.mapTiles() === t.id ? '700' : '500'"
                style="padding:7px 10px;border-radius:8px;border:none;cursor:pointer;
                       font-size:13px;text-align:left;transition:all 0.1s">
          {{t.label}}
        </button>
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  screen = signal<Screen>('map');
  showSignIn = signal(false);
  showSettings = signal(false);
  selectedDisplay = signal<ListingSummary | null>(null);
  viewingHost = signal<HostUser | null>(null);
  editingListing = signal<ListingSummary | null>(null);
  editSource = signal<'admin' | null>(null);
  initialFilters: InitialFilters | null = null;
  isMobile = window.innerWidth < 768;

  accentOptions = ACCENT_OPTIONS;
  tileOptions = TILE_OPTIONS;

  constructor(
    public authService: AuthService,
    public upvoteService: UpvoteService,
    private location: Location,
  ) {}

  private listingApi = inject(ListingApiService);

  private parseInitialFilters(): InitialFilters | null {
    const params = new URLSearchParams(window.location.search);
    const result: InitialFilters = {};
    const cat = params.get('category');
    if (cat && Object.keys(CATEGORY_LABELS).includes(cat)) result.category = cat as Category;
    const lat = parseFloat(params.get('lat') ?? '');
    const lng = parseFloat(params.get('lng') ?? '');
    if (!isNaN(lat) && !isNaN(lng)) { result.lat = lat; result.lng = lng; }
    const radius = parseInt(params.get('radius') ?? '', 10);
    if (!isNaN(radius) && radius >= 1 && radius <= 100) result.radius = radius;
    const tags = params.get('tags');
    if (tags) result.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    return Object.keys(result).length > 0 ? result : null;
  }

  ngOnInit() {
    this.authService.init();
    this.initialFilters = this.parseInitialFilters();
    const path = this.location.path();
    if (path.startsWith('/submit')) this.screen.set('submit');
    else if (path.startsWith('/profile')) this.screen.set('profile');
    else if (path.startsWith('/admin')) this.screen.set('admin');
    else if (path.startsWith('/hosts')) this.location.replaceState('/');
    else if (path.startsWith('/host/')) {
      const handle = path.split('/')[2]?.split('?')[0];
      if (handle) {
        this.screen.set('host');
        this.listingApi.getHostListingsByHandle(handle).subscribe({
          next: resp => {
            this.viewingHost.set(resp.user);
          },
          error: () => {
            this.screen.set('map');
            this.location.replaceState('/');
          },
        });
      }
    }
    else if (path.startsWith('/host')) {
      this.location.replaceState('/');
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
  }

  navigate(screen: string) {
    if ((screen === 'submit' || screen === 'profile') && !this.authService.currentUser()) {
      this.showSignIn.set(true);
      return;
    }
    if (screen !== 'host') this.viewingHost.set(null);
    if (screen !== 'submit') this.editingListing.set(null);
    this.screen.set(screen as Screen);
    this.showSettings.set(false);
    this.location.replaceState(screen === 'map' ? '/' : '/' + screen);
  }

  onAuthAction() {
    if (this.authService.currentUser()) {
      this.authService.logout();
    } else {
      this.showSignIn.set(true);
    }
  }

  signIn() {
    this.showSignIn.set(false);
    this.authService.login();
  }

  openDetail(display: ListingSummary) {
    this.selectedDisplay.set(display);
  }

  openHostProfile(host: HostUser) {
    this.selectedDisplay.set(null);
    this.viewingHost.set(host);
    this.screen.set('host');
    this.location.replaceState('/host/' + (host.handle ?? host.id));
  }

  onSubmitDone() {
    const source = this.editSource();
    this.editingListing.set(null);
    this.editSource.set(null);
    this.screen.set(source === 'admin' ? 'admin' : 'map');
  }

  onSubmitCancel() {
    const source = this.editSource();
    this.editingListing.set(null);
    this.editSource.set(null);
    this.screen.set(source === 'admin' ? 'admin' : 'map');
  }

  onAdminEditListing(listing: ListingSummary) {
    this.editSource.set('admin');
    this.editingListing.set(listing);
    this.screen.set('submit');
  }

  isUpvoted(id: number) {
    return this.upvoteService.upvotedIds().has(id);
  }

  onFiltersChanged(state: FilterState) {
    if (this.screen() !== 'map') return;
    this.initialFilters = null;
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.tags.length) params.set('tags', state.tags.join(','));
    params.set('lat', state.lat.toFixed(5));
    params.set('lng', state.lng.toFixed(5));
    if (state.radius !== 10) params.set('radius', String(state.radius));
    // replaceState(path, query) — Angular appends query as ?... when non-empty
    this.location.replaceState('/', params.toString());
  }

  setAccent(id: string) {
    this.authService.setAccent(id);
  }

  setTiles(id: string) {
    this.authService.setTiles(id);
  }
}
