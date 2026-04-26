import { Component, Input, Output, EventEmitter } from '@angular/core';
import { HostEntity, ListingSummary } from '../../models/listing.model';

@Component({
  selector: 'app-manage-host',
  standalone: true,
  imports: [],
  template: `<div style="padding:40px;text-align:center;color:#94a3b8">Loading host management…</div>`
})
export class ManageHostComponent {
  @Input() host!: HostEntity;
  @Output() back = new EventEmitter<void>();
  @Output() addListing = new EventEmitter<HostEntity>();
  @Output() editListing = new EventEmitter<ListingSummary>();
}
