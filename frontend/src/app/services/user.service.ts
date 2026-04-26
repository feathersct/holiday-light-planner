import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HostEntity, HostSearchResult } from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  getMyHosts(): Observable<HostEntity[]> {
    return this.http.get<ApiResponse<HostEntity[]>>(
      `${this.base}/hosts/me`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateDisplayName(displayName: string): Observable<HostSearchResult> {
    return this.http.patch<ApiResponse<HostSearchResult>>(
      `${this.base}/users/me`, { displayName }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }
}
