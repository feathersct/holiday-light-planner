package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateHandleRequest {

    @NotBlank
    @Size(min = 3, max = 30, message = "Handle must be 3-30 characters")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Handle must contain only lowercase letters, numbers, and hyphens")
    private String handle;
}
