import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sign-in-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div (click)="close.emit()"
         style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:3000;
                display:flex;align-items:center;justify-content:center;padding:20px">
      <div (click)="$event.stopPropagation()"
           style="background:white;border-radius:20px;width:380px;padding:36px;
                  box-shadow:0 24px 64px rgba(0,0,0,0.2)">
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:48px;height:48px;border-radius:12px;
                      background:linear-gradient(135deg,var(--accent),#ef4444);
                      margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l-1.41 1.41M6.34 17.66l-1.41 1.41" stroke="white" stroke-width="2"/>
            </svg>
          </div>
          <div style="font-weight:800;font-size:20px;color:#0f172a;margin-bottom:6px">Sign in to Event Mapster</div>
          <div style="font-size:13.5px;color:#64748b;line-height:1.5">Upvote your favourites, submit a display,<br>and save your discoveries.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button (click)="signIn.emit()"
                  style="display:flex;align-items:center;gap:12px;padding:11px 18px;
                         border:1.5px solid #e2e8f0;border-radius:10px;background:white;
                         cursor:pointer;font-size:14px;font-weight:600;color:#0f172a;
                         transition:background 0.1s;width:100%"
                  (mouseenter)="$any($event.target).style.background='#f8fafc'"
                  (mouseleave)="$any($event.target).style.background='white'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Continue with Facebook
          </button>
        </div>
        <div style="margin-top:18px;font-size:11.5px;color:#94a3b8;text-align:center;line-height:1.5">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  `
})
export class SignInModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();
}
