import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User, ALL_TAGS, TYPE_LABELS } from '../../models/display.model';
import { TagBadgeComponent } from '../../shared/tag-badge/tag-badge.component';

const TYPES = Object.entries(TYPE_LABELS) as [string, string][];

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
          <div style="font-weight:800;font-size:24px;color:#0f172a;margin-bottom:10px">Display Submitted!</div>
          <div style="font-size:15px;color:#64748b;line-height:1.6;max-width:340px;margin:0 auto 32px">
            Thanks for adding to the community map. Your display will appear after a quick review.
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
            <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">Add a Display</div>
            <div style="font-size:13.5px;color:#64748b">Share a holiday light display with the community</div>
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
                <input [(ngModel)]="form.address" placeholder="123 Christmas Lane, City, State"
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                       (focus)="$any($event.target).style.borderColor='var(--accent)'"
                       (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
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
              </div>
            </div>
          </div>

          <!-- Step 2: Details -->
          <div *ngIf="step() === 'details'">
            <div style="font-weight:700;font-size:16px;color:#0f172a;margin-bottom:16px">
              2 of 3 — Display Details
            </div>
            <div style="display:flex;flex-direction:column;gap:14px">
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Title *</label>
                <input [(ngModel)]="form.title" placeholder="The Johnson Family Christmas Spectacular"
                       style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                              font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                       (focus)="$any($event.target).style.borderColor='var(--accent)'"
                       (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
              </div>
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
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Tags</label>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  <button *ngFor="let tag of allTags" (click)="toggleTag(tag)"
                          [style.opacity]="form.tags.includes(tag) ? '1' : '0.5'"
                          style="background:none;border:none;cursor:pointer;padding:0;transition:opacity 0.15s">
                    <app-tag-badge [tag]="tag" [small]="true"/>
                  </button>
                </div>
              </div>
              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Description</label>
                <textarea [(ngModel)]="form.description" rows="3"
                          placeholder="Tell visitors what to expect — animated displays, music sync, drive-through route…"
                          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                 font-size:14px;color:#0f172a;background:white;box-sizing:border-box;
                                 resize:none;font-family:inherit;outline:none"
                          (focus)="$any($event.target).style.borderColor='var(--accent)'"
                          (blur)="$any($event.target).style.borderColor='#e2e8f0'"></textarea>
              </div>
              <div style="display:flex;gap:12px">
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Year Started</label>
                  <input [(ngModel)]="form.yearStarted" type="number" placeholder="2018"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
                </div>
                <div style="flex:1">
                  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Admission ($)</label>
                  <input [(ngModel)]="form.admissionPrice" type="number" placeholder="0 = Free"
                         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
                         (focus)="$any($event.target).style.borderColor='var(--accent)'"
                         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Photo -->
          <div *ngIf="step() === 'photo'">
            <div style="font-weight:700;font-size:16px;color:#0f172a;margin-bottom:16px">
              3 of 3 — Add a Photo (optional)
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
          <div style="display:flex;gap:12px;margin-top:28px">
            <button *ngIf="step() !== 'location'" (click)="prevStep()"
                    style="flex:1;padding:13px;border-radius:12px;font-size:15px;font-weight:600;
                           background:none;border:1.5px solid #e2e8f0;color:#374151;cursor:pointer">
              Back
            </button>
            <button (click)="nextStep()"
                    [disabled]="!canAdvance()"
                    [style.opacity]="canAdvance() ? '1' : '0.5'"
                    style="flex:2;padding:13px;border-radius:12px;font-size:15px;font-weight:700;
                           background:var(--accent);color:white;border:none;cursor:pointer">
              {{step() === 'photo' ? 'Submit Display' : 'Continue'}}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SubmitComponent {
  @Input() user: any = null;
  @Output() goHome = new EventEmitter<void>();

  step = signal<'location' | 'details' | 'photo' | 'done'>('location');
  steps = ['location', 'details', 'photo'];
  types = TYPES;
  allTags = ALL_TAGS;
  photoPreview: string | null = null;

  form = {
    address: '', city: '', state: '',
    title: '', displayType: 'residential', tags: [] as string[],
    description: '', yearStarted: null as number | null,
    admissionPrice: null as number | null,
  };

  getStepIndex() {
    return this.steps.indexOf(this.step() as any);
  }

  toggleTag(tag: string) {
    const idx = this.form.tags.indexOf(tag);
    if (idx > -1) this.form.tags.splice(idx, 1);
    else this.form.tags.push(tag);
  }

  canAdvance() {
    if (this.step() === 'location') return this.form.address.trim() && this.form.city.trim();
    if (this.step() === 'details') return this.form.title.trim() && this.form.displayType;
    return true;
  }

  nextStep() {
    if (this.step() === 'location') this.step.set('details');
    else if (this.step() === 'details') this.step.set('photo');
    else if (this.step() === 'photo') this.step.set('done');
  }

  prevStep() {
    if (this.step() === 'details') this.step.set('location');
    else if (this.step() === 'photo') this.step.set('details');
  }

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => this.photoPreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }
}
