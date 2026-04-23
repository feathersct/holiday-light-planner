import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Display, DisplaySummary, Tag, Report,
  PagedResponse, SearchParams, CreateDisplayRequest
} from '../models/display.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class DisplayApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  search(params: SearchParams): Observable<PagedResponse<DisplaySummary>> {
    let p = new HttpParams()
      .set('lat', params.lat)
      .set('lng', params.lng)
      .set('radiusMiles', params.radiusMiles ?? 10)
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 50);
    if (params.displayType) p = p.set('displayType', params.displayType);
    if (params.tags?.length) p = p.set('tags', params.tags.join(','));
    return this.http.get<ApiResponse<PagedResponse<DisplaySummary>>>(`${this.base}/displays/search`, { params: p })
      .pipe(map(r => r.data));
  }

  getById(id: number): Observable<Display> {
    return this.http.get<ApiResponse<Display>>(`${this.base}/displays/${id}`)
      .pipe(map(r => r.data));
  }

  create(request: CreateDisplayRequest): Observable<Display> {
    return this.http.post<ApiResponse<Display>>(`${this.base}/displays`, request)
      .pipe(map(r => r.data));
  }

  uploadPhoto(displayId: number, file: File): Observable<{ id: number; url: string; isPrimary: boolean }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<{ id: number; url: string; isPrimary: boolean }>>(`${this.base}/displays/${displayId}/photos`, fd)
      .pipe(map(r => r.data));
  }

  upvote(displayId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/displays/${displayId}/upvote`, {});
  }

  removeUpvote(displayId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/displays/${displayId}/upvote`);
  }

  report(displayId: number, reason: string, notes: string): Observable<void> {
    return this.http.post<void>(`${this.base}/displays/${displayId}/report`, { reason, notes });
  }

  getTags(): Observable<Tag[]> {
    return this.http.get<ApiResponse<Tag[]>>(`${this.base}/tags`)
      .pipe(map(r => r.data));
  }

  getMyDisplays(): Observable<DisplaySummary[]> {
    return this.http.get<ApiResponse<DisplaySummary[]>>(`${this.base}/displays/mine`)
      .pipe(map(r => r.data));
  }

  getUpvotedDisplays(): Observable<DisplaySummary[]> {
    return this.http.get<ApiResponse<DisplaySummary[]>>(`${this.base}/displays/upvoted`)
      .pipe(map(r => r.data));
  }

  getReports(status?: string, page = 0, size = 20): Observable<PagedResponse<Report>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (status && status !== 'ALL') p = p.set('status', status);
    return this.http.get<ApiResponse<PagedResponse<Report>>>(`${this.base}/admin/reports`, { params: p })
      .pipe(map(r => r.data));
  }

  updateReport(reportId: number, status: string): Observable<Report> {
    return this.http.patch<ApiResponse<Report>>(`${this.base}/admin/reports/${reportId}`, { status })
      .pipe(map(r => r.data));
  }

  deleteDisplay(displayId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/displays/${displayId}`);
  }

  adminGetDisplays(active?: boolean, page = 0, size = 50): Observable<PagedResponse<DisplaySummary>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (active !== undefined) p = p.set('active', active);
    return this.http.get<ApiResponse<PagedResponse<DisplaySummary>>>(`${this.base}/admin/displays`, { params: p })
      .pipe(map(r => r.data));
  }

  adminSetDisplayActive(displayId: number, active: boolean): Observable<DisplaySummary> {
    return this.http.patch<ApiResponse<DisplaySummary>>(`${this.base}/admin/displays/${displayId}/status`, { active })
      .pipe(map(r => r.data));
  }

  adminDeleteDisplay(displayId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/displays/${displayId}`);
  }
}
