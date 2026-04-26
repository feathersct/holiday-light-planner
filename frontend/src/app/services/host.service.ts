import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HostEntity, HostListingsResponse, HostSearchResult } from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class HostService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  searchHosts(q: string): Observable<HostSearchResult[]> {
    return this.http.get<ApiResponse<HostEntity[]>>(
      `${this.base}/hosts`, { params: { q }, withCredentials: true }
    ).pipe(
      map(r => r.data.map(h => ({ id: h.id, name: h.displayName, displayName: h.displayName, avatarUrl: h.avatarUrl, handle: h.handle } as HostSearchResult))),
      catchError(() => of([] as HostSearchResult[]))
    );
  }

  getHostListings(userId: number): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/hosts/${userId}/listings`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  getHostListingsByHandle(handle: string): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/hosts/handle/${handle}`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  getHostManagedListings(hostId: number): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/hosts/${hostId}/listings`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  createHost(displayName: string, handle: string): Observable<HostEntity> {
    return this.http.post<ApiResponse<HostEntity>>(
      `${this.base}/hosts`, { displayName, handle }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateHost(id: number, displayName?: string, handle?: string): Observable<HostEntity> {
    const body: Record<string, string> = {};
    if (displayName !== undefined) body['displayName'] = displayName;
    if (handle !== undefined) body['handle'] = handle;
    return this.http.patch<ApiResponse<HostEntity>>(
      `${this.base}/hosts/${id}`, body, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  uploadHostAvatar(id: number, file: File): Observable<HostEntity> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<HostEntity>>(
      `${this.base}/hosts/${id}/avatar`, fd, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  deleteHost(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/hosts/${id}`, { withCredentials: true }
    );
  }

  transferHost(id: number, targetHandle: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/hosts/${id}/transfer`, { targetHandle }, { withCredentials: true }
    );
  }
}
