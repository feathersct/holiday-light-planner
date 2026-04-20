package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.CreateDisplayRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.DisplayResponse;
import com.christmaslightmap.dto.response.DisplaySummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.service.DisplayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/displays")
@RequiredArgsConstructor
public class DisplayController {

    private final DisplayService displayService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<DisplaySummaryResponse>>> search(
        @RequestParam double lat,
        @RequestParam double lng,
        @RequestParam(defaultValue = "10") double radiusMiles,
        @RequestParam(required = false) List<Long> tags,
        @RequestParam(required = false) String displayType,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            displayService.searchDisplays(lat, lng, radiusMiles, tags, displayType, page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DisplayResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(displayService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DisplayResponse>> create(
        @RequestBody CreateDisplayRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(displayService.createDisplay(userId, request)));
    }
}
