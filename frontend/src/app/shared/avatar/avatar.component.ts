import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#0d9488','#f97316'];

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [style.width.px]="size" [style.height.px]="size" [style.background]="color"
         [style.font-size.px]="size * 0.36"
         style="border-radius:50%;flex-shrink:0;display:flex;align-items:center;
                justify-content:center;color:white;font-weight:700;letter-spacing:-0.5px;">
      {{initials}}
    </div>
  `
})
export class AvatarComponent {
  @Input() initials = '';
  @Input() size = 32;

  get color() {
    return PALETTE[(this.initials.charCodeAt(0) + (this.initials.charCodeAt(1) || 0)) % PALETTE.length];
  }
}
