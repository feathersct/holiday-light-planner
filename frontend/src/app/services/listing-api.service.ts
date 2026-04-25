import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  Listing, ListingSummary, Tag, Report, HostListingsResponse, HostSearchResult, HostEntity,
  PagedResponse, SearchParams, CreateListingRequest, UpdateListingRequest
} from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class ListingApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  search(params: SearchParams): Observable<PagedResponse<ListingSummary>> {
    let p = new HttpParams()
      .set('lat', params.lat)
      .set('lng', params.lng)
      .set('radiusMiles', params.radiusMiles ?? 10)
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 50);
    if (params.category) p = p.set('category', params.category);
    if (params.tags?.length) p = p.set('tags', params.tags.join(','));
    return this.http.get<ApiResponse<PagedResponse<ListingSummary>>>(`${this.base}/listings/search`, { params: p, withCredentials: true })
      .pipe(map(r => r.data));
  }

  getById(id: number): Observable<Listing> {
    return this.http.get<ApiResponse<Listing>>(`${this.base}/listings/${id}`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  create(request: CreateListingRequest): Observable<Listing> {
    return this.http.post<ApiResponse<Listing>>(`${this.base}/listings`, request, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  update(id: number, request: UpdateListingRequest): Observable<Listing> {
    return this.http.patch<ApiResponse<Listing>>(`${this.base}/listings/${id}`, request, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  deletePhoto(listingId: number, photoId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}/photos/${photoId}`, { withCredentials: true });
  }

  uploadPhoto(listingId: number, file: File): Observable<{ id: number; url: string; isPrimary: boolean }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<{ id: number; url: string; isPrimary: boolean }>>(`${this.base}/listings/${listingId}/photos`, fd, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  upvote(listingId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/listings/${listingId}/upvote`, {}, { withCredentials: true });
  }

  removeUpvote(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}/upvote`, { withCredentials: true });
  }

  report(listingId: number, reason: string, notes: string): Observable<void> {
    return this.http.post<void>(`${this.base}/listings/${listingId}/report`, { reason, notes }, { withCredentials: true });
  }

  getTags(): Observable<Tag[]> {
    return this.http.get<ApiResponse<Tag[]>>(`${this.base}/tags`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  getUpvotedListings(): Observable<ListingSummary[]> {
    return this.http.get<ApiResponse<ListingSummary[]>>(`${this.base}/listings/upvoted`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  getHostListings(userId: number): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/users/${userId}/listings`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  getHostListingsByHandle(handle: string): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/users/handle/${handle}`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  searchHosts(q: string): Observable<HostSearchResult[]> {
    return this.http.get<ApiResponse<HostEntity[]>>(
      `${this.base}/hosts`, { params: { q }, withCredentials: true }
    ).pipe(
      map(r => r.data.map(h => ({ id: h.id, name: h.displayName, displayName: h.displayName, avatarUrl: h.avatarUrl, handle: h.handle } as HostSearchResult))),
      catchError(() => of([] as HostSearchResult[]))
    );
  }

  updateDisplayName(displayName: string): Observable<HostSearchResult> {
    return this.http.patch<ApiResponse<HostSearchResult>>(
      `${this.base}/users/me`, { displayName }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateHandle(handle: string): Observable<HostSearchResult> {
    return this.http.patch<ApiResponse<HostSearchResult>>(
      `${this.base}/users/me/handle`, { handle }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  getReports(status?: string, page = 0, size = 20): Observable<PagedResponse<Report>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (status && status !== 'ALL') p = p.set('status', status);
    return this.http.get<ApiResponse<PagedResponse<Report>>>(`${this.base}/admin/reports`, { params: p, withCredentials: true })
      .pipe(map(r => r.data));
  }

  updateReport(reportId: number, status: string): Observable<Report> {
    return this.http.patch<ApiResponse<Report>>(`${this.base}/admin/reports/${reportId}`, { status }, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  deleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}`, { withCredentials: true });
  }

  adminGetListings(active?: boolean, page = 0, size = 50): Observable<PagedResponse<ListingSummary>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (active !== undefined) p = p.set('active', active);
    return this.http.get<ApiResponse<PagedResponse<ListingSummary>>>(`${this.base}/admin/listings`, { params: p, withCredentials: true })
      .pipe(map(r => r.data));
  }

  adminSetListingActive(listingId: number, active: boolean): Observable<ListingSummary> {
    return this.http.patch<ApiResponse<ListingSummary>>(`${this.base}/admin/listings/${listingId}/status`, { active }, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  adminUpdateListing(id: number, request: UpdateListingRequest): Observable<Listing> {
    return this.http.patch<ApiResponse<Listing>>(`${this.base}/admin/listings/${id}`, request, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  adminDeleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/listings/${listingId}`, { withCredentials: true });
  }

  getMyHosts(): Observable<HostEntity[]> {
    return this.http.get<ApiResponse<HostEntity[]>>(
      `${this.base}/hosts/me`, { withCredentials: true }
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
