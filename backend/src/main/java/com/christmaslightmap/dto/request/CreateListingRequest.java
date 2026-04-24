package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayType;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateListingRequest {
    private Category category;
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String priceInfo;
    // Christmas Lights only
    private String bestTime;
    private DisplayType displayType;
    private List<Long> tagIds = List.of();
    // Food Truck only
    private String cuisineType;
    // Estate Sale only
    private String organizer;
    // Christmas Lights + Food Truck only
    private String websiteUrl;
}
