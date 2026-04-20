package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.User;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserResponse {

    private Long id;
    private String email;
    private String name;
    private String avatarUrl;
    private String role;

    public static UserResponse from(User user) {
        return UserResponse.builder()
            .id(user.getId())
            .email(user.getEmail())
            .name(user.getName())
            .avatarUrl(user.getAvatarUrl())
            .role(user.getRole().name())
            .build();
    }
}
