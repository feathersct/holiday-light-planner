import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Report, Listing, ListingSummary, PagedResponse, UpdateListingRequest } from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  getReports(status?: string, page = 0, size = 20): Observable<PagedResponse<Report>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (status && status !== 'ALL') p = p.set('status', status);
    return this.http.get<ApiResponse<PagedResponse<Report>>>(
      `${this.base}/admin/reports`, { params: p, withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateReport(reportId: number, status: string): Observable<Report> {
    return this.http.patch<ApiResponse<Report>>(
      `${this.base}/admin/reports/${reportId}`, { status }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminGetListings(active?: boolean, page = 0, size = 50): Observable<PagedResponse<ListingSummary>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (active !== undefined) p = p.set('active', active);
    return this.http.get<ApiResponse<PagedResponse<ListingSummary>>>(
      `${this.base}/admin/listings`, { params: p, withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminSetListingActive(listingId: number, active: boolean): Observable<ListingSummary> {
    return this.http.patch<ApiResponse<ListingSummary>>(
      `${this.base}/admin/listings/${listingId}/status`, { active }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminUpdateListing(id: number, request: UpdateListingRequest): Observable<Listing> {
    return this.http.patch<ApiResponse<Listing>>(
      `${this.base}/admin/listings/${id}`, request, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminDeleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/admin/listings/${listingId}`, { withCredentials: true }
    );
  }
}
