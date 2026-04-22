package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Tag;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TagResponse {

    private Long id;
    private String name;

    public static TagResponse from(Tag tag) {
        return TagResponse.builder()
            .id(tag.getId())
            .name(tag.getName())
            .build();
    }
}
