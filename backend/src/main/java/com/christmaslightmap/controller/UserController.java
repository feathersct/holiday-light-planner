package com.christmaslightmap.controller;

import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostListingsResponse;
import com.christmaslightmap.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{userId}/listings")
    public ResponseEntity<ApiResponse<HostListingsResponse>> getHostListings(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getHostListings(userId)));
    }
}
