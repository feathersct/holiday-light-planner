package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.DisplaySummaryResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.model.Display;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.DisplayRepository;
import com.christmaslightmap.repository.TagRepository;
import com.christmaslightmap.repository.UpvoteRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DisplayService {

    private final DisplayRepository displayRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final DisplayPhotoRepository displayPhotoRepository;
    private final UpvoteRepository upvoteRepository;

    public List<DisplaySummaryResponse> getMyDisplays(Long userId) {
        return displayRepository.findByUserIdAndIsActiveTrue(userId).stream()
            .map(this::mapDisplayToSummary)
            .collect(Collectors.toList());
    }

    public List<DisplaySummaryResponse> getUpvotedDisplays(Long userId) {
        return upvoteRepository.findByUserIdWithActiveDisplays(userId).stream()
            .map(u -> mapDisplayToSummary(u.getDisplay()))
            .collect(Collectors.toList());
    }

    private DisplaySummaryResponse mapDisplayToSummary(Display display) {
        String primaryPhotoUrl = displayPhotoRepository.findByDisplay_Id(display.getId()).stream()
            .filter(p -> p.isPrimary())
            .map(p -> p.getUrl())
            .findFirst().orElse(null);
        return DisplaySummaryResponse.builder()
            .id(display.getId())
            .title(display.getTitle())
            .city(display.getCity())
            .state(display.getState())
            .lat(display.getLocation().getY())
            .lng(display.getLocation().getX())
            .upvoteCount(display.getUpvoteCount())
            .photoCount(display.getPhotoCount())
            .displayType(display.getDisplayType().name())
            .primaryPhotoUrl(primaryPhotoUrl)
            .tags(display.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .build();
    }
}
