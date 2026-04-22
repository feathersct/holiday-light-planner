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
          <div style="font-weight:800;font-size:20px;color:#0f172a;margin-bottom:6px">Sign in to Luminary</div>
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
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
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
