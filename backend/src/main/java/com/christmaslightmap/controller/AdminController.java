package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.AdminDisplayRequest;
import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.DisplaySummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.ReportResponse;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.service.AdminService;
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

    @GetMapping("/displays")
    public ResponseEntity<ApiResponse<PagedResponse<DisplaySummaryResponse>>> getAllDisplays(
        @RequestParam(required = false) Boolean active,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getAllDisplays(active, page, size)));
    }

    @PatchMapping("/displays/{id}/status")
    public ResponseEntity<ApiResponse<DisplaySummaryResponse>> setDisplayActive(
        @PathVariable Long id,
        @RequestBody AdminDisplayRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.setDisplayActive(id, request.isActive())));
    }

    @DeleteMapping("/displays/{id}")
    public ResponseEntity<ApiResponse<Void>> adminDeleteDisplay(@PathVariable Long id) {
        adminService.adminDeleteDisplay(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
