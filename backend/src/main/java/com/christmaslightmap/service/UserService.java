package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import com.christmaslightmap.dto.response.HostUserResponse;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public HostUserResponse updateDisplayName(Long userId, UpdateDisplayNameRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        String name = request.getDisplayName();
        if (name == null || name.isBlank()) {
            user.setDisplayName(null);
        } else {
            String trimmed = name.trim();
            user.setDisplayName(trimmed.substring(0, Math.min(trimmed.length(), 100)));
        }
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
