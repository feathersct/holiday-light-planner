package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.AdminDisplayRequest;
import com.christmaslightmap.dto.request.UpdateListingRequest;
import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.ListingResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.ReportResponse;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.service.AdminService;
import com.christmaslightmap.service.ListingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final ListingService listingService;

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<PagedResponse<ReportResponse>>> getReports(
        @RequestParam(required = false) ReportStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getReports(status, page, size)));
    }

    @PatchMapping("/reports/{id}")
    public ResponseEntity<ApiResponse<ReportResponse>> updateReport(
        @PathVariable Long id,
        @RequestBody UpdateReportRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateReport(id, request)));
    }

    @GetMapping("/listings")
    public ResponseEntity<ApiResponse<PagedResponse<ListingSummaryResponse>>> getAllListings(
        @RequestParam(required = false) Boolean active,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getAllListings(active, page, size)));
    }

    @PatchMapping("/listings/{id}/status")
    public ResponseEntity<ApiResponse<ListingSummaryResponse>> setListingActive(
        @PathVariable Long id,
        @RequestBody AdminDisplayRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.setListingActive(id, request.isActive())));
    }

    @PatchMapping("/listings/{id}")
    public ResponseEntity<ApiResponse<ListingResponse>> adminUpdateListing(
        @PathVariable Long id,
        @RequestBody UpdateListingRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(listingService.adminUpdateListing(id, request)));
    }

    @DeleteMapping("/listings/{id}")
    public ResponseEntity<ApiResponse<Void>> adminDeleteListing(@PathVariable Long id) {
        adminService.adminDeleteListing(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
