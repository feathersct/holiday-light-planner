package com.christmaslightmap.service;

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
}
