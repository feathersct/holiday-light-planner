package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.ApiResponse;
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
}
