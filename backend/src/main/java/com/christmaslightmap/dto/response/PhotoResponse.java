package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.DisplayPhoto;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PhotoResponse {
    private Long id;
    private String url;
    private boolean isPrimary;

    public static PhotoResponse from(DisplayPhoto photo) {
        return PhotoResponse.builder()
            .id(photo.getId())
            .url(photo.getUrl())
            .isPrimary(photo.isPrimary())
            .build();
    }
}
