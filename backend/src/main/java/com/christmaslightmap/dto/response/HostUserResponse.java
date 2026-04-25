package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Host;
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
    private String handle;

    public static HostUserResponse from(User user) {
        return HostUserResponse.builder()
            .id(user.getId())
            .name(user.getName())
            .displayName(user.getDisplayName())
            .avatarUrl(user.getAvatarUrl())
            .handle(user.getHandle())
            .build();
    }

    public static HostUserResponse from(Host host) {
        return HostUserResponse.builder()
            .id(host.getId())
            .name(host.getDisplayName())
            .displayName(host.getDisplayName())
            .avatarUrl(host.getAvatarUrl())
            .handle(host.getHandle())
            .build();
    }
}
