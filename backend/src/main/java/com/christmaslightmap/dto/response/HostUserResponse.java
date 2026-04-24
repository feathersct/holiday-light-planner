package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HostUserResponse {
    private Long id;
    private String name;
    private String avatarUrl;
}
