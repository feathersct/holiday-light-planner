import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TAG_STYLES } from '../../models/listing.model';

@Component({
  selector: 'app-tag-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [style.background]="style.bg" [style.color]="style.text"
          [style.padding]="small ? '2px 7px' : '3px 9px'"
          [style.font-size]="small ? '10px' : '11px'"
          style="border-radius:99px;font-weight:600;display:inline-block;white-space:nowrap;">
      {{tag}}
    </span>
  `
})
export class TagBadgeComponent {
  @Input() tag = '';
  @Input() small = false;

  get style() {
    return TAG_STYLES[this.tag] || { bg: '#f3f4f6', text: '#374151' };
  }
}
