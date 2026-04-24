package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class HostListingsResponse {
    private HostUserResponse user;
    private List<ListingSummaryResponse> listings;
}
