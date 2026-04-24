package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostListingsResponse;
import com.christmaslightmap.dto.response.HostUserResponse;
import com.christmaslightmap.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{userId}/listings")
    public ResponseEntity<ApiResponse<HostListingsResponse>> getHostListings(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getHostListings(userId)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<HostUserResponse>>> searchHosts(
        @RequestParam String q
    ) {
        return ResponseEntity.ok(ApiResponse.success(userService.searchHosts(q)));
    }

    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<HostUserResponse>> updateDisplayName(
        @RequestBody UpdateDisplayNameRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(userService.updateDisplayName(userId, request)));
    }
}
