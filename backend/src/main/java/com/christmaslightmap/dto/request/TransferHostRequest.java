package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TransferHostRequest {
    @NotBlank
    private String targetHandle;
}
