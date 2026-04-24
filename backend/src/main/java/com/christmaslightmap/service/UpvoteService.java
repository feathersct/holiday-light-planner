package com.christmaslightmap.service;

import com.christmaslightmap.model.Upvote;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.UpvoteRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UpvoteService {

    private final UpvoteRepository upvoteRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    @Transactional
    public boolean upvote(Long userId, Long displayId) {
        if (upvoteRepository.countByUserAndListing(userId, displayId) > 0) {
            return false;
        }
        var display = listingRepository.findById(displayId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        upvoteRepository.saveAndFlush(Upvote.builder().user(user).listing(display).build());
        return true;
    }

    @Transactional
    public boolean removeUpvote(Long userId, Long displayId) {
        if (upvoteRepository.countByUserAndListing(userId, displayId) == 0) {
            return false;
        }
        upvoteRepository.deleteByUserIdAndListingId(userId, displayId);
        return true;
    }
}
