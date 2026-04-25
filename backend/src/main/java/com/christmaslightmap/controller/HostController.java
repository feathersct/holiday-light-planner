package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.CreateHostRequest;
import com.christmaslightmap.dto.request.TransferHostRequest;
import com.christmaslightmap.dto.request.UpdateHostRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostResponse;
import com.christmaslightmap.service.HostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hosts")
@RequiredArgsConstructor
public class HostController {

    private final HostService hostService;

    @PostMapping
    public ResponseEntity<ApiResponse<HostResponse>> createHost(
        @Valid @RequestBody CreateHostRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(hostService.createHost(userId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<HostResponse>>> searchHosts(@RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.success(hostService.searchHosts(q)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<HostResponse>>> getMyHosts(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(hostService.getMyHosts(userId)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<HostResponse>> updateHost(
        @PathVariable Long id,
        @Valid @RequestBody UpdateHostRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(hostService.updateHost(userId, id, request)));
    }

    @PostMapping("/{id}/avatar")
    public ResponseEntity<ApiResponse<HostResponse>> uploadAvatar(
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(hostService.uploadAvatar(userId, id, file)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHost(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        hostService.deleteHost(userId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/transfer")
    public ResponseEntity<Void> transferHost(
        @PathVariable Long id,
        @Valid @RequestBody TransferHostRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        hostService.transferHost(userId, id, request);
        return ResponseEntity.noContent().build();
    }
}
