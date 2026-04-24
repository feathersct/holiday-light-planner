package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.CreateListingRequest;
import com.christmaslightmap.dto.request.ReportRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.ListingResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.PhotoResponse;
import com.christmaslightmap.service.ListingService;
import com.christmaslightmap.service.PhotoService;
import com.christmaslightmap.service.ReportService;
import com.christmaslightmap.service.UpvoteService;
import org.springframework.web.multipart.MultipartFile;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/listings")
@RequiredArgsConstructor
public class ListingController {

    private final ListingService listingService;
    private final UpvoteService upvoteService;
    private final PhotoService photoService;
    private final ReportService reportService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<ListingSummaryResponse>>> search(
        @RequestParam double lat,
        @RequestParam double lng,
        @RequestParam(defaultValue = "10") double radiusMiles,
        @RequestParam(required = false) List<Long> tags,
        @RequestParam(required = false) String category,
        @RequestParam(defaultValue = "false") boolean includeExpired,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            listingService.searchListings(lat, lng, radiusMiles, tags, category, includeExpired, page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ListingResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(listingService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ListingResponse>> create(
        @RequestBody CreateListingRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(listingService.createListing(userId, request)));
    }

    @PostMapping("/{id}/upvote")
    public ResponseEntity<ApiResponse<Void>> upvote(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        if (!upvoteService.upvote(userId, id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.success(null));
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/photos")
    public ResponseEntity<ApiResponse<PhotoResponse>> uploadPhoto(
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(photoService.uploadPhoto(id, userId, file)));
    }

    @PostMapping("/{id}/report")
    public ResponseEntity<ApiResponse<Void>> report(
        @PathVariable Long id,
        @RequestBody ReportRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        reportService.createReport(userId, id, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}/upvote")
    public ResponseEntity<ApiResponse<Void>> removeUpvote(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        if (!upvoteService.removeUpvote(userId, id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.success(null));
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteListing(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        listingService.deleteListing(userId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<ListingSummaryResponse>>> getMyListings(
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(listingService.getMyListings(userId)));
    }

    @GetMapping("/upvoted")
    public ResponseEntity<ApiResponse<List<ListingSummaryResponse>>> getUpvotedListings(
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(listingService.getUpvotedListings(userId)));
    }
}
