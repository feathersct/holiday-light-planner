package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.DisplayType;
import lombok.Data;

import java.util.List;

@Data
public class CreateDisplayRequest {
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private String bestTime;
    private DisplayType displayType;
    private List<Long> tagIds = List.of();
}
