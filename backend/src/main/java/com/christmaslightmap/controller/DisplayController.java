package com.christmaslightmap.controller;

import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.DisplaySummaryResponse;
import com.christmaslightmap.service.DisplayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/displays")
@RequiredArgsConstructor
public class DisplayController {

    private final DisplayService displayService;

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<DisplaySummaryResponse>>> getMyDisplays(
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(displayService.getMyDisplays(userId)));
    }

    @GetMapping("/upvoted")
    public ResponseEntity<ApiResponse<List<DisplaySummaryResponse>>> getUpvotedDisplays(
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(displayService.getUpvotedDisplays(userId)));
    }
}
