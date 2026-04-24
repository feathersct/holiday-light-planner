package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import com.christmaslightmap.dto.request.UpdateHandleRequest;
import com.christmaslightmap.dto.response.*;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final DisplayPhotoRepository displayPhotoRepository;

    public HostListingsResponse getHostListings(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Listing> listings = listingRepository.findUpcomingByUserId(userId, LocalDateTime.now());

        List<Long> ids = listings.stream().map(Listing::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = ids.isEmpty() ? Map.of() :
            displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
                .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));

        List<ListingSummaryResponse> summaries = listings.stream()
            .map(l -> {
                String hostName = l.getHostName();
                String displayName = user.getDisplayName();
                String userName = user.getName();
                String resolvedHostName = hostName != null ? hostName : (displayName != null ? displayName : userName);
                return ListingSummaryResponse.builder()
                    .id(l.getId())
                    .title(l.getTitle())
                    .city(l.getCity())
                    .state(l.getState())
                    .lat(l.getLocation().getY())
                    .lng(l.getLocation().getX())
                    .upvoteCount(l.getUpvoteCount())
                    .photoCount(l.getPhotoCount())
                    .category(l.getCategory())
                    .displayType(l.getDisplayType() != null ? l.getDisplayType().name() : null)
                    .primaryPhotoUrl(primaryUrls.get(l.getId()))
                    .tags(l.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
                    .isActive(l.isActive())
                    .startDatetime(l.getStartDatetime())
                    .endDatetime(l.getEndDatetime())
                    .priceInfo(l.getPriceInfo())
                    .cuisineType(l.getCuisineType())
                    .organizer(l.getOrganizer())
                    .websiteUrl(l.getWebsiteUrl())
                    .resolvedHostName(resolvedHostName)
                    .build();
            })
            .collect(Collectors.toList());

        return HostListingsResponse.builder()
            .user(HostUserResponse.from(user))
            .listings(summaries)
            .build();
    }

    public List<HostUserResponse> searchHosts(String q) {
        return userRepository.searchHosts(q.trim(), LocalDateTime.now()).stream()
            .limit(10)
            .map(HostUserResponse::from)
            .collect(Collectors.toList());
    }

    @Transactional
    public HostUserResponse updateDisplayName(Long userId, UpdateDisplayNameRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        String name = request.getDisplayName();
        user.setDisplayName((name == null || name.isBlank()) ? null : name.trim().substring(0, Math.min(name.trim().length(), 100)));
        return HostUserResponse.from(userRepository.save(user));
    }

    public HostListingsResponse getHostListingsByHandle(String handle) {
        User user = userRepository.findByHandle(handle)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
        return getHostListings(user.getId());
    }

    @Transactional
    public HostUserResponse updateHandle(Long userId, UpdateHandleRequest request) {
        if (userRepository.existsByHandleAndIdNot(request.getHandle(), userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setHandle(request.getHandle());
        return HostUserResponse.from(userRepository.save(user));
    }

    public String generateUniqueHandle(String displayName, String fallbackName) {
        String source = (displayName != null && !displayName.isBlank()) ? displayName : fallbackName;
        if (source == null || source.isBlank()) source = "user";
        String slug = source.toLowerCase()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
        if (slug.length() < 3) slug = "user-" + slug;
        if (slug.length() > 20) slug = slug.substring(0, 20).replaceAll("-+$", "");
        if (!userRepository.existsByHandle(slug)) return slug;
        for (int i = 2; i <= 99; i++) {
            String candidate = slug + "-" + i;
            if (!userRepository.existsByHandle(candidate)) return candidate;
        }
        return slug + "-" + (System.currentTimeMillis() % 10000);
    }
}
