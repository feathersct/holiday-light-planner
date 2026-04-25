package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UpdateHostRequest {
    @Size(max = 100)
    private String displayName;

    @Size(min = 3, max = 30)
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Handle may only contain lowercase letters, numbers, and hyphens")
    private String handle;
}
