import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Listing, ListingSummary, Tag,
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

  deleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}`, { withCredentials: true });
  }
}
