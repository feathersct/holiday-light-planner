package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class HostResponse {
    private Long id;
    private String handle;
    private String displayName;
    private String avatarUrl;
    private int listingCount;
    private LocalDateTime createdAt;
}
