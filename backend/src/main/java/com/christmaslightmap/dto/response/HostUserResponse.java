package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.User;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HostUserResponse {
    private Long id;
    private String name;
    private String displayName;
    private String avatarUrl;

    public static HostUserResponse from(User user) {
        return HostUserResponse.builder()
            .id(user.getId())
            .name(user.getName())
            .displayName(user.getDisplayName())
            .avatarUrl(user.getAvatarUrl())
            .build();
    }
}
